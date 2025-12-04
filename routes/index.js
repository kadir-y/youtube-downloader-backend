const { YtDlp } = require('ytdlp-nodejs');
const router = require('express').Router();
const ytdlp = new YtDlp();
const getThumbnail = require('../libs/getThumbnail');
const fs = require('fs');
const { createWriteStream } = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

router.get('/get-metadata', async (req, res, next) => {
  try {
    const videoLink = req.query.link;
    if (!videoLink) {
      return res.status(400).json({ error: 'Missing video link' });
    }

    const info = await ytdlp.getInfoAsync(videoLink);
    const data = {};
    
    if (info._type === "playlist") {
      data.id = info.id;
      data.title = info.title;
      data.type = "playlist";
      data.thumbnail = getThumbnail(info.thumbnails, 360);
      data.uploader = info.uploader_id;
      data.videos = info.entries.map(entry => ({
        id: entry.id,
        title: entry.title,
        url: entry.url || videoLink,
        thumbnail: getThumbnail(entry.thumbnails, 360),
        selected: false
      }));
    } else {
      data.id = info.id;
      data.title = info.title;
      data.type = "video";
      data.thumbnail = getThumbnail(info.thumbnails, 360);
      data.uploader = info.uploader;
      data.videos = [{
        id: info.id,
        title: info.title,
        url: videoLink,
        thumbnail: getThumbnail(info.thumbnails, 360),
        selected: false
      }];
    }
    
    res.json({ list: data });
  } catch (err) {
    next(err);
  }
});

router.get('/download', async (req, res, next) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.flushHeaders();

  const quality = req.query.quality || 'best';
  const type = req.query.type || 'video';
  const format = type === "audioonly" ? 'mp3' : 'mp4';
  const filename = `${uuid()}.${format}`;
  const filePath = path.join(__dirname, "../tmp", filename);
  const downloadUrl = req.query.link;
  let st;
  let ytdlpStream;
  let isCompleted = false;

  // tmp klasörünü oluştur
  const tmpDir = path.join(__dirname, "../tmp");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  req.on('close', () => {
    console.log('Client disconnected');
    if (st && !st.closed) st.close();
    // Sadece tamamlanmamışsa sil
    if (!isCompleted) {
      fs.unlink(filePath, (err) => {
        if (!err) console.log('Incomplete file deleted.');
      });
    }
  });

  try {
    st = createWriteStream(filePath);

    ytdlpStream = ytdlp.stream(downloadUrl, {
      onProgress: (progress) => {
        res.write(`data: ${JSON.stringify(progress)}\n\n`);
      },
    });

    st.on('error', (error) => {
      console.error('Stream write error:', error);
      if (!res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
        res.end();
      }
    });

    await ytdlpStream.pipeAsync(st);

    // Dosyanın varlığını kontrol et
    if (fs.existsSync(filePath)) {
      isCompleted = true;
      console.log('Download completed, file saved:', filePath);
      res.write(`event: done\ndata: ${JSON.stringify({ message: 'Download finished', file: filename })}\n\n`);
      res.end();
    } else {
      throw new Error('File was not created after download');
    }

  } catch (error) {
    console.error('Download error:', error);
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
      res.end();
    } else {
      next(error);
    }
  }
});

// OPTIONS isteği için handler ekle
router.options('/download', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.send();
});

// Dosyayı indir
router.get('/download-file/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "../tmp", filename);
  
  // Güvenlik: Sadece tmp klasöründen dosya ver
  if (!filePath.startsWith(path.join(__dirname, "../tmp"))) {
    return res.status(403).send('Forbidden');
  }

  // Dosya var mı kontrol et
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('Download error:', err);
    } else {
      console.log('File downloaded, deleting:', filename);
    }
    // İndirme tamamlandıktan sonra dosyayı sil
    fs.unlink(filePath, (unlinkErr) => {
      if (!unlinkErr) console.log('File deleted after download:', filename);
    });
  });
});

module.exports = router;
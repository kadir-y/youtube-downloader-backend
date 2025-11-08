const { YtDlp } = require('ytdlp-nodejs');
const router = require('express').Router();
const ytdlp = new YtDlp();
const getThumbnail = require('../libs/getThumbnail');

router.get('/get-metadata', async (req, res) => {
  const videoLink = req.query.link;
  if (!videoLink) {
    return res.status(400).send('Missing video link');
  }

  const info = await ytdlp.getInfoAsync(videoLink);
  const data = {}

  if (info._type == "playlist") {
    data.title = info.title;
    data.type = "playlist";
    data.thumbnail = info.thumbnails[info.thumbnails.length - 1];
    data.uploader = info.uploader_id;
    data.videos = info.entries.map(entry => ({
        title: entry.title,
        uploader: entry.uploader_id,
        duration: entry.duration,
        thumbnail: getThumbnail(entry.thumbnails, 360),
    }));
  } else if (info._type == "video") {
    data.title = info.title;
    data.type = "video";
    data.thumbnail = getThumbnail(info.thumbnails, 360);
    data.uploader = info.uploader_id;
    data.duration = info.duration;
  }

  res.json(data);
});

module.exports = router;
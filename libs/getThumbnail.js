module.exports = function getThumbnail (thumbnails, resolutions) {
  thumbnails.sort((a, b) => a.height - b.height);
  let thumbnail = thumbnails[thumbnails.length - 1];
  for (const thumb of thumbnails) {
    if (thumb.height >= resolutions) {
        thumbnail = thumb;
        break;
    }
  }
  return thumbnail;
}
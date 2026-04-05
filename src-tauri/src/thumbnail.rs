use std::io::Cursor;
use std::path::Path;

use crate::error::AppError;

pub fn generate_thumbnail(
    src_path: &Path,
    thumb_dir: &Path,
    item_id: &str,
    size: u32,
) -> Result<std::path::PathBuf, AppError> {
    let img = image::open(src_path).map_err(|e| AppError::Io(format!("Failed to open {:?}: {e}", src_path)))?;
    // Convert to RGB8 first — JPEG doesn't support RGBA
    let rgb_img = img.to_rgb8();

    // Calculate dimensions that fit within size×size while preserving aspect ratio
    let (orig_w, orig_h) = rgb_img.dimensions();
    let scale = (size as f64 / orig_w as f64).min(size as f64 / orig_h as f64);
    let target_w = (orig_w as f64 * scale).round() as u32;
    let target_h = (orig_h as f64 * scale).round() as u32;
    let thumb = image::imageops::thumbnail(&rgb_img, target_w, target_h);

    std::fs::create_dir_all(thumb_dir)?;

    let dest = thumb_dir.join(format!("{item_id}.jpg"));
    let mut buf = Cursor::new(Vec::new());
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 85);
    thumb.write_with_encoder(encoder).map_err(|e| AppError::Io(format!("JPEG encode failed: {e}")))?;

    std::fs::write(&dest, buf.into_inner())?;
    Ok(dest)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_image(path: &Path) {
        let img = image::RgbImage::from_pixel(800, 600, image::Rgb([100, 150, 200]));
        img.save(path).unwrap();
    }

    #[test]
    fn test_thumbnail_aspect_ratio() {
        let dir = tempfile::tempdir().unwrap();
        // Create a 800x600 (4:3 landscape) image
        let src = dir.path().join("test_ar.jpg");
        let img = image::RgbImage::from_pixel(800, 600, image::Rgb([100, 150, 200]));
        img.save(&src).unwrap();

        let thumb_dir = dir.path().join("thumbs");
        let result = generate_thumbnail(&src, &thumb_dir, "ar-test", 256).unwrap();

        let thumb_img = image::open(&result).unwrap();
        assert_eq!(thumb_img.width(), 256);
        assert_eq!(thumb_img.height(), 192); // 800/600 = 4/3, 256/(4/3) = 192
    }

    #[test]
    fn test_thumbnail_portrait() {
        let dir = tempfile::tempdir().unwrap();
        // Create a 600x800 (3:4 portrait) image
        let src = dir.path().join("test_portrait.jpg");
        let img = image::RgbImage::from_pixel(600, 800, image::Rgb([100, 150, 200]));
        img.save(&src).unwrap();

        let thumb_dir = dir.path().join("thumbs");
        let result = generate_thumbnail(&src, &thumb_dir, "portrait-test", 256).unwrap();

        let thumb_img = image::open(&result).unwrap();
        assert_eq!(thumb_img.width(), 192); // 600/800 = 3/4, 256*(3/4) = 192
        assert_eq!(thumb_img.height(), 256);
    }

    #[test]
    fn test_generate_thumbnail_jpg() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("test.jpg");
        create_test_image(&src);

        let thumb_dir = dir.path().join("thumbs");
        let result = generate_thumbnail(&src, &thumb_dir, "item-1", 256).unwrap();

        assert!(result.exists());
        assert!(result.to_string_lossy().contains("item-1.jpg"));

        let thumb_img = image::open(&result).unwrap();
        assert!(thumb_img.width() <= 256);
        assert!(thumb_img.height() <= 256);
    }

    #[test]
    fn test_generate_thumbnail_png() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("test.png");
        create_test_image(&src);

        let thumb_dir = dir.path().join("thumbs");
        let result = generate_thumbnail(&src, &thumb_dir, "item-2", 256).unwrap();
        assert!(result.exists());
    }

    #[test]
    fn test_corrupted_file() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("bad.jpg");
        std::fs::write(&src, b"not an image").unwrap();

        let thumb_dir = dir.path().join("thumbs");
        let result = generate_thumbnail(&src, &thumb_dir, "item-3", 256);
        assert!(result.is_err());
    }
}

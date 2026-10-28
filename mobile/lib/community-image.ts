import * as ImageManipulator from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

const MAX_IMAGE_DIMENSION = 1920;

export async function prepareCommunityImageUpload(asset: ImagePickerAsset) {
  if (!(Number.isFinite(asset.width) && Number.isFinite(asset.height) && asset.width > 0 && asset.height > 0)) {
    throw new Error('이미지 크기를 확인하지 못했습니다.');
  }

  // Prefer the cached file's extension over the photo library's original name.
  const extension = asset.uri.match(/\.(gif|png|jpe?g|webp|heic|heif|avif|bmp|tiff?)(?:[?#]|$)/i)?.[1]?.toLowerCase();
  const isGif = extension ? extension === 'gif' : asset.mimeType === 'image/gif' || (!asset.mimeType && /\.gif$/i.test(asset.fileName ?? ''));
  if (isGif) {
    // Re-encoding GIF would discard its animation, just as in the web editor.
    return { file: { name: 'community.gif', type: 'image/gif', uri: asset.uri }, width: asset.width, height: asset.height };
  }

  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  let image: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  try {
    context.resize(asset.width >= asset.height
      ? { width: Math.min(asset.width, MAX_IMAGE_DIMENSION) }
      : { height: Math.min(asset.height, MAX_IMAGE_DIMENSION) });
    image = await context.renderAsync();
    // HEIC and missing/stale MIME metadata need actual pixel conversion.
    // WebP matches the web editor and preserves transparency in PNG/WebP inputs.
    const saved = await image.saveAsync({ compress: 0.85, format: ImageManipulator.SaveFormat.WEBP });
    return { file: { name: 'community.webp', type: 'image/webp', uri: saved.uri }, width: saved.width, height: saved.height };
  } catch (error) {
    throw new Error('이미지를 처리하지 못했습니다. 다른 사진을 선택해주세요.', { cause: error });
  } finally {
    image?.release();
    context.release();
  }
}

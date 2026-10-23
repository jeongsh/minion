import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export async function pickProfileImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    mediaTypes: ['images'],
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    quality: 1,
  });
  if (picked.canceled || !picked.assets[0]) return null;
  const asset = picked.assets[0];
  if (Platform.OS === 'web') {
    if ((asset.file?.size ?? asset.fileSize ?? 0) > 5 * 1024 * 1024) {
      throw new Error('프로필 이미지는 5MB 이하만 업로드할 수 있습니다.');
    }
    return asset;
  }
  // iOS may return HEIC or omit MIME metadata. Convert actual pixels before
  // constructing FormData; renaming the original file does not convert it.
  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  let image: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  try {
    if (!(asset.width > 0 && asset.height > 0)) throw new Error('사진 크기를 확인하지 못했습니다.');
    context.resize(asset.width >= asset.height ? { width: Math.min(asset.width, 512) } : { height: Math.min(asset.height, 512) });
    image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
    return { ...saved, fileName: 'profile.jpg', mimeType: 'image/jpeg', type: 'image' };
  } catch (error) {
    throw new Error('사진을 처리하지 못했습니다. 다른 사진을 선택해주세요.', { cause: error });
  } finally {
    image?.release();
    context.release();
  }
}

import type { ImagePickerAsset } from 'expo-image-picker';

import type { MobileCommunityVideoConfirmDto, MobileCommunityVideoSignDto } from './api-client';
import { mutateMobileApi } from './api-client';

// 웹 components/community/editor/editor-image-upload.ts와 같은 한도와 형식.
export const MAX_COMMUNITY_VIDEO_MB = 50;
export const MAX_COMMUNITY_VIDEOS = 3;
const MAX_VIDEO_BYTES = MAX_COMMUNITY_VIDEO_MB * 1024 * 1024;
const VIDEO_PATH = '/api/mobile/v1/community/upload/video';

function videoContentType(asset: ImagePickerAsset) {
  const extension = (asset.uri.match(/\.(mp4|m4v|mov|webm)(?:[?#]|$)/i)?.[1] ?? asset.fileName?.match(/\.(mp4|m4v|mov|webm)$/i)?.[1] ?? '').toLowerCase();
  if (extension === 'mp4' || extension === 'm4v') return 'video/mp4';
  if (extension === 'mov') return 'video/quicktime';
  if (extension === 'webm') return 'video/webm';
  if (asset.mimeType && ['video/mp4', 'video/quicktime', 'video/webm'].includes(asset.mimeType)) return asset.mimeType;
  return null;
}

// fetch는 업로드 진행률을 주지 않아 XHR로 Storage 서명 URL에 바로 올린다.
function putWithProgress(url: string, body: Blob, contentType: string, onProgress?: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('cache-control', 'max-age=31536000');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(Math.min(99, Math.floor((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('동영상 업로드에 실패했습니다.')));
    xhr.onerror = () => reject(new Error('동영상 업로드에 실패했습니다.'));
    xhr.send(body);
  });
}

export async function uploadCommunityVideo(asset: ImagePickerAsset, onProgress?: (percent: number) => void) {
  const contentType = videoContentType(asset);
  if (!contentType) throw new Error('MP4, WEBM, MOV 동영상만 첨부할 수 있습니다.');
  const file = await fetch(asset.uri).then((response) => response.blob());
  if (file.size <= 0 || file.size > MAX_VIDEO_BYTES) throw new Error(`동영상은 ${MAX_COMMUNITY_VIDEO_MB}MB 이하만 첨부할 수 있습니다.`);

  const signed = await mutateMobileApi<MobileCommunityVideoSignDto>(VIDEO_PATH, 'POST', { action: 'sign', contentType, height: asset.height, size: file.size, width: asset.width });
  onProgress?.(0);
  await putWithProgress(signed.signedUrl, file, contentType, onProgress);
  return mutateMobileApi<MobileCommunityVideoConfirmDto>(VIDEO_PATH, 'POST', { action: 'confirm', path: signed.path });
}

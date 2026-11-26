export function mediaUploadPlaceholderStyle(colors: { accent: string; color: string; muted: string; mutedSurface: string }) {
  return `
[data-upload-placeholder] {
  background: ${colors.mutedSurface};
  background: color-mix(in srgb, ${colors.mutedSurface} 68%, ${colors.muted});
  border-radius: 8px;
  display: block;
  margin: 12px 0;
  max-width: 100%;
  overflow: hidden;
  pointer-events: none;
  position: relative;
}
[data-upload-placeholder]::after {
  animation: community-upload-spin 0.8s linear infinite;
  border: 3px solid transparent;
  border: 3px solid color-mix(in srgb, ${colors.accent} 24%, transparent);
  border-radius: 50%;
  border-top-color: ${colors.accent};
  box-sizing: border-box;
  content: "";
  height: 26px;
  left: calc(50% - 13px);
  position: absolute;
  top: calc(50% - 13px);
  width: 26px;
}
[data-upload-placeholder][data-progress]::before {
  color: ${colors.color};
  content: attr(data-progress);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  inset-inline: 0;
  position: absolute;
  text-align: center;
  top: calc(50% + 22px);
}
@keyframes community-upload-spin {
  to { transform: rotate(360deg); }
}
`;
}

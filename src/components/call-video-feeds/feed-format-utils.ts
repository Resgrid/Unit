export const FeedFormat = {
  RTSP: 0,
  HLS: 1,
  MJPEG: 2,
  YouTubeLive: 3,
  WebRTC: 4,
  DASH: 5,
  Embed: 6,
  Other: 99,
} as const;

export const FeedType = {
  Drone: 0,
  FixedCamera: 1,
  BodyCam: 2,
  TrafficCam: 3,
  WeatherCam: 4,
  SatelliteFeed: 5,
  WebCam: 6,
  Other: 99,
} as const;

export const FeedStatus = {
  Active: 0,
  Inactive: 1,
  Error: 2,
} as const;

export const FEED_TYPE_LABELS: Record<number, string> = {
  [FeedType.Drone]: 'video_feeds.type_drone',
  [FeedType.FixedCamera]: 'video_feeds.type_fixed_camera',
  [FeedType.BodyCam]: 'video_feeds.type_body_cam',
  [FeedType.TrafficCam]: 'video_feeds.type_traffic_cam',
  [FeedType.WeatherCam]: 'video_feeds.type_weather_cam',
  [FeedType.SatelliteFeed]: 'video_feeds.type_satellite_feed',
  [FeedType.WebCam]: 'video_feeds.type_web_cam',
  [FeedType.Other]: 'video_feeds.type_other',
};

export const FEED_FORMAT_LABELS: Record<number, string> = {
  [FeedFormat.RTSP]: 'video_feeds.format_rtsp',
  [FeedFormat.HLS]: 'video_feeds.format_hls',
  [FeedFormat.MJPEG]: 'video_feeds.format_mjpeg',
  [FeedFormat.YouTubeLive]: 'video_feeds.format_youtube_live',
  [FeedFormat.WebRTC]: 'video_feeds.format_webrtc',
  [FeedFormat.DASH]: 'video_feeds.format_dash',
  [FeedFormat.Embed]: 'video_feeds.format_embed',
  [FeedFormat.Other]: 'video_feeds.format_other',
};

export const FEED_STATUS_LABELS: Record<number, string> = {
  [FeedStatus.Active]: 'video_feeds.status_active',
  [FeedStatus.Inactive]: 'video_feeds.status_inactive',
  [FeedStatus.Error]: 'video_feeds.status_error',
};

export const detectFeedFormat = (url: string): number | null => {
  const lower = url.toLowerCase();

  if (lower.includes('.m3u8')) return FeedFormat.HLS;
  if (lower.includes('.mpd')) return FeedFormat.DASH;
  if (lower.startsWith('rtsp://')) return FeedFormat.RTSP;
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return FeedFormat.YouTubeLive;
  if (lower.includes('mjpeg') || lower.includes('mjpg')) return FeedFormat.MJPEG;

  return null;
};

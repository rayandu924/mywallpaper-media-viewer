# Media Viewer

A universal media display widget for [MyWallpaper](https://mywallpaper.app) that supports images, videos, GIFs, and more.

![Media Viewer Preview](preview.png)

## Features

- **Multi-format support**: Images (JPEG, PNG, GIF, WebP, SVG, AVIF), Videos (MP4, WebM, OGG, MOV)
- **Flexible sourcing**: Load from URL or upload local files
- **Smart scaling**: Multiple object-fit modes (contain, cover, fill, none, scale-down)
- **Visual effects**: Blur, brightness, contrast, saturation, hue rotation
- **Video controls**: Autoplay, loop, mute, playback speed, native controls
- **Auto-refresh**: Periodic reload for webcams or updating images
- **Hot-reload**: Settings update instantly without page refresh
- **Responsive**: Adapts to any widget size
- **Lightweight**: No external dependencies

## Installation

### From MyWallpaper Store
1. Open MyWallpaper
2. Go to **Add Widget** > **Store**
3. Search for "Media Viewer"
4. Click **Install**

### Manual Installation
1. Download or clone this repository
2. Zip the contents (manifest.json, index.html, styles.css)
3. In MyWallpaper, go to **Add Widget** > **Import**
4. Select the zip file

### Development Mode
1. Clone this repository
2. Start a local server:
   ```bash
   # Using npx
   npx serve .

   # Or Python
   python -m http.server 5173
   ```
3. In MyWallpaper, go to **Settings** > **Developer**
4. Enter `http://localhost:5173`
5. Enable **Developer Mode**

## Usage

### Basic Setup
1. Add the Media Viewer widget to your desktop
2. Right-click the widget and select **Settings**
3. Enter a media URL or upload a file
4. Adjust display options as needed

### Supported Formats

| Type | Extensions |
|------|------------|
| Images | jpg, jpeg, png, gif, webp, svg, ico, bmp, avif, tiff |
| Videos | mp4, webm, ogg, mov, m4v |
| Animated | gif, webp (animated), mp4 (looped) |

### Settings Reference

#### Media Source
| Setting | Description |
|---------|-------------|
| **Media URL** | Direct URL to image or video |
| **Upload Media** | Upload from local device |

#### Display Options
| Setting | Description | Default |
|---------|-------------|---------|
| **Scaling Mode** | How media fits the widget | Fit (contain) |
| **Position** | Alignment within widget | Center |
| **Background Color** | Color behind media | Transparent |
| **Corner Radius** | Rounded corners in pixels | 0 |

#### Video Options
| Setting | Description | Default |
|---------|-------------|---------|
| **Autoplay** | Start playing automatically | On |
| **Loop** | Repeat when finished | On |
| **Muted** | No sound (required for autoplay) | On |
| **Show Controls** | Display video controls | Off |
| **Playback Speed** | Speed multiplier (0.25x - 2x) | 1x |

#### Visual Effects
| Setting | Description | Default |
|---------|-------------|---------|
| **Opacity** | Transparency (0-100%) | 100% |
| **Blur** | Gaussian blur (0-50px) | 0 |
| **Brightness** | Light adjustment (0-200%) | 100% |
| **Contrast** | Contrast adjustment (0-200%) | 100% |
| **Saturation** | Color intensity (0-200%) | 100% |
| **Hue Rotate** | Color shift (0-360°) | 0 |

#### Advanced
| Setting | Description | Default |
|---------|-------------|---------|
| **Fallback Text** | Message when media fails to load | "Media unavailable" |
| **Auto-Refresh** | Reload interval in minutes (0 = disabled) | 0 |

## Examples

### Display a Web Image
```
Media URL: https://example.com/beautiful-landscape.jpg
Scaling Mode: Cover
```

### Loop a Video Background
```
Media URL: https://example.com/ambient-video.mp4
Autoplay: On
Loop: On
Muted: On
Scaling Mode: Cover
```

### Webcam Feed
```
Media URL: https://example.com/webcam/current.jpg
Auto-Refresh: 1 (minute)
```

### Artistic Effect
```
Media URL: (your image)
Blur: 5
Brightness: 110%
Saturation: 120%
Opacity: 80%
```

## SDK Features Used

This addon demonstrates several MyWallpaper SDK features:

- **Hot-reload**: `api.onSettingsChange()` for instant setting updates
- **Lifecycle**: `onPause()`/`onResume()` to pause video when hidden
- **System events**: `viewport:resize`, `theme:change`, `visibility:change`
- **Storage permission**: For future favorites/history feature
- **Network permission**: For loading external media URLs

## Development

### Project Structure
```
mywallpaper-media-viewer/
├── manifest.json    # Addon metadata and settings
├── index.html       # Main HTML with JavaScript
├── styles.css       # Styles
├── icon.svg         # Addon icon (optional)
├── preview.png      # Store preview image
└── README.md        # This file
```

### Building

No build step required! This addon uses vanilla HTML/CSS/JavaScript.

### Testing

1. Start local server: `npx serve .`
2. Enable Dev Mode in MyWallpaper
3. Make changes and refresh

### Contributing

1. Fork this repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See [LICENSE](LICENSE) for details.

## Credits

- Built with [MyWallpaper Addon SDK](https://github.com/rayandu924/rust-k8s-microservices/tree/main/packages/addon-sdk)
- Icons from [Feather Icons](https://feathericons.com/)

## Changelog

### v1.0.0 (2024)
- Initial release
- Image and video support
- Visual effects (blur, brightness, contrast, saturation, hue)
- Auto-refresh feature
- Hot-reload settings

/* eslint-env node */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const inputPng = path.join(__dirname, '../assets/icon.png');
const outputIco = path.join(__dirname, '../assets/icon.ico');
const tempPng = path.join(__dirname, '../assets/icon-256.png');

try {
  console.log('Resizing icon to 256x256 using PowerShell...');
  // Use PowerShell to resize the image because we don't want to add sharp/jimp dependencies just for this one-off
  const psCommand = `
    Add-Type -AssemblyName System.Drawing;
    $img = [System.Drawing.Image]::FromFile('${inputPng}');
    $newImg = new-object System.Drawing.Bitmap(256, 256);
    $graph = [System.Drawing.Graphics]::FromImage($newImg);
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;
    $graph.DrawImage($img, 0, 0, 256, 256);
    $newImg.Save('${tempPng}', [System.Drawing.Imaging.ImageFormat]::Png);
    $img.Dispose();
    $newImg.Dispose();
    $graph.Dispose();
  `;

  execSync(`powershell -Command "${psCommand.replace(/\n/g, ' ')}"`, { stdio: 'inherit' });

  if (!fs.existsSync(tempPng)) {
    throw new Error('Failed to create resized PNG');
  }

  console.log('Generating ICO file...');
  const pngBuffer = fs.readFileSync(tempPng);
  // size variable removed as it was unused

  // ICO Header
  // 0-1: Reserved (0)
  // 2-3: Type (1 for ICO)
  // 4-5: Number of images (1)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  // Icon Directory Entry
  // 0: Width (0 for 256)
  // 1: Height (0 for 256)
  // 2: Color count (0 for >= 256 colors)
  // 3: Reserved (0)
  // 4-5: Color planes (1)
  // 6-7: Bits per pixel (32)
  // 8-11: Size of image data
  // 12-15: Offset of image data
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); // 256 width -> 0
  entry.writeUInt8(0, 1); // 256 height -> 0
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(6 + 16, 12); // Header (6) + 1 Entry (16)

  const icoBuffer = Buffer.concat([header, entry, pngBuffer]);
  fs.writeFileSync(outputIco, icoBuffer);

  // Clean up
  fs.unlinkSync(tempPng);

  console.log(`Successfully created ${outputIco}`);
} catch (error) {
  console.error('Error generating ICO:', error);
  process.exit(1);
}

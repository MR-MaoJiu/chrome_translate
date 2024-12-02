const sharp = require('sharp');
const fs = require('fs');

// 创建基础SVG图标
const svgIcon = `
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="#4285f4" rx="20"/>
  <text x="64" y="80" font-size="80" text-anchor="middle" fill="white">T</text>
</svg>
`;

// 确保images目录存在
if (!fs.existsSync('./images')) {
  fs.mkdirSync('./images');
}

// 生成不同尺寸的图标
const sizes = [16, 48, 128];

sizes.forEach(size => {
  sharp(Buffer.from(svgIcon))
    .resize(size, size)
    .png()
    .toFile(`./images/icon${size}.png`)
    .catch(err => console.error(`Error generating ${size}x${size} icon:`, err));
}); 
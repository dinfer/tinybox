import * as thumbhash from 'thumbhash';

import decodeJPEG, { init as initJPEGDecode } from '@jsquash/jpeg/decode';
import JPEG_DEC_WASM from '@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm';
await initJPEGDecode(JPEG_DEC_WASM);

import encodeJPEG, { init as initJPEGEncode } from '@jsquash/jpeg/encode';
import JPEG_ENC_WASM from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm';
await initJPEGEncode(JPEG_ENC_WASM);

import decodeWEBP, { init as initWEBPDecode } from '@jsquash/webp/decode';
import WEBP_DEC_WASM from '@jsquash/webp/codec/dec/webp_dec.wasm';
await initWEBPDecode(WEBP_DEC_WASM);

import encodeWEBP, { init as initWEBPEncode } from '@jsquash/webp/encode';
import WEBP_ENC_WASM from '@jsquash/webp/codec/enc/webp_enc.wasm';
await initWEBPEncode(WEBP_ENC_WASM);

import decodeAVIF, { init as initAVIFDecode } from '@jsquash/avif/decode';
import AVIF_DEC_WASM from '@jsquash/avif/codec/dec/avif_dec.wasm';
await initAVIFDecode(AVIF_DEC_WASM);

import encodeAVIF, { init as initAVIFEncode } from '@jsquash/avif/encode';
import AVIF_ENC_WASM from '@jsquash/avif/codec/enc/avif_enc.wasm';
await initAVIFEncode(AVIF_ENC_WASM);

import decodePNG, { init as initPNGDecode } from '@jsquash/png/decode';
import PNG_DEC_WASM from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm';
initPNGDecode(PNG_DEC_WASM);

import optimisePNG, { init as initOXIPNG } from '@jsquash/oxipng/optimise';
import OXIPNG_WASM from '@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm';
initOXIPNG(OXIPNG_WASM);

import resize, { initResize } from '@jsquash/resize';
import RESIZE_WASM from '@jSquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm';
initResize(RESIZE_WASM);

export async function optimise(file: File, options: { supports: string[] }) {
	let ext = '';
	let raw: ImageData | null = null;
	switch (file.type) {
		case 'image/png':
			raw = await decodePNG(await file.arrayBuffer());
			ext = '.png';
			break;
		case 'image/jpeg':
			raw = await decodeJPEG(await file.arrayBuffer());
			ext = '.jpeg';
			break;
		case 'image/webp':
			raw = await decodeWEBP(await file.arrayBuffer());
			ext = '.webp';
			break;
		case 'image/avif':
			raw = await decodeAVIF(await file.arrayBuffer());
			ext = '.avif';
			break;
		default:
			raw = null;
	}

	if (!raw || !ext) {
		throw new Error('Unsupported image type');
	}

	const { width, height } = raw;
	const files: { type: string; data: ArrayBuffer; diff: number; byteLength: number }[] = [];

	if (options.supports.includes('image/avif')) {
		const data = await encodeAVIF(raw, {});
		const byteLength = data.byteLength;
		const diff = raw.data.byteLength - data.byteLength;
		files.push({ type: 'image/avif', data, diff, byteLength });
	}
	if (options.supports.includes('image/jpeg')) {
		const data = await encodeJPEG(raw, {});
		const byteLength = data.byteLength;
		const diff = raw.data.byteLength - byteLength;
		files.push({ type: 'image/jpeg', data, diff, byteLength });
	}
	if (options.supports.includes('image/webp')) {
		const data = await encodeWEBP(raw, {});
		const byteLength = data.byteLength;
		const diff = raw.data.byteLength - byteLength;
		files.push({ type: 'image/webp', data, diff, byteLength });
	}
	if (file.type !== 'image/jpeg' && options.supports.includes('png')) {
		const data = await optimisePNG(raw, { level: 2, optimiseAlpha: true });
		const byteLength = data.byteLength;
		const diff = raw.data.byteLength - byteLength;
		files.push({ type: 'image/jpeg', data, diff, byteLength });
	}

	const thumbnail = await resize(raw, { width: 100, height: 100, fitMethod: 'contain' });

	const hash = thumbhash.rgbaToThumbHash(thumbnail.width, thumbnail.height, thumbnail.data);

	return { raw, ext, width, height, thumbnail, hash, byteLength: raw.data.byteLength, files: files.sort((a, b) => a.diff - b.diff) };
}

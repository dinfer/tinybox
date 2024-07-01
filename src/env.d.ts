// declare module "*.wasm" {
// 	export default any;
// }

declare interface ImageData {
	width: number;
	height: number;
	data: Uint8ClampedArray;
}

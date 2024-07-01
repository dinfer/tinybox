/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { nanoid } from 'nanoid';
import { optimise } from './optimise';
import { toHex } from './hex';

class DurationSpan {
	public _start: number;
	public _duration: number = -1;
	public _message?: string;
	public _tags: Record<string, unknown> = {};
	constructor(readonly name: string) {
		this._start = Date.now();
	}
	message(message: string) {
		this._message = message;
		return this;
	}
	tags(tags: Record<string, unknown>) {
		this._tags = { ...this._tags, ...tags };
		return this;
	}
	end() {
		this._duration = Date.now() - this._start;
	}
}

class Duration {
	protected spans: DurationSpan[] = [];
	span(name: string) {
		const span = new DurationSpan(name);
		this.spans.push(span);
		return span;
	}
	dump() {
		for (const item of this.spans) {
			console.log('>', item.name, item._duration, item._message, item._tags);
		}
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const duration = new Duration();

		// receive

		const receiveSpan = duration.span('duration');
		const formData = await request.formData();
		const file = formData.get('file');
		if (!(file instanceof File)) {
			const message = 'cannot get file';
			return new Response(JSON.stringify({ ok: 0, message }), { status: 400 });
		}
		receiveSpan.end();

		// optimise

		let accept = request.headers.get('accept');
		if (!accept || accept.startsWith('*/*')) {
			accept = 'image/avif,image/webp,image/png,*/*;q=0.8';
		}
		const supports = accept
			.split(',')
			.map((v) => v.trim().split(';')[0])
			.filter((v) => !!v);

		const compressSpan = duration.span('compress');
		const info = await optimise(file, { supports });
		compressSpan.end();

		// save
		// const clientName = `_`;
		// const md5 = crypto.subtle.digest('MD5', info.raw.data);
		// const tasks: (() => Promise<R2Object | null>)[] = [];
		// for (const file of info.files) {
		// 	tasks.push(async () => {
		// 		const id = nanoid();
		// 		return env.BUCKET.put(`/image-opts/${clientName}/${id}${info.ext}`, file.data);
		// 	});
		// }

		duration.dump();

		const best = info.files[0];
		if (!best) {
			const message = 'cannot get any encoded file';
			return new Response(JSON.stringify({ ok: 0, message }), { status: 500 });
		}

		return new Response(best.data, {
			headers: {
				'Content-Type': best.type,
				'X-Image-Width': String(info.width),
				'X-Image-Height': String(info.height),
				'X-Image-Size-Reduced': String(best.diff),
				'X-Image-Hash': toHex(info.hash),
			},
		});
	},
} satisfies ExportedHandler<Env>;

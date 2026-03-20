import crypto from 'node:crypto';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const collectRequestBody = async (request: NodeJS.ReadableStream): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(Buffer.from(chunk));
    }
  }
  return Buffer.concat(chunks);
};

const sortSearchParams = (params: URLSearchParams): string => {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of params.entries()) {
    if (key === 'sig') continue;
    entries.push([key, value]);
  }
  entries.sort((a, b) => {
    if (a[0] === b[0]) return a[1].localeCompare(b[1]);
    return a[0].localeCompare(b[0]);
  });
  return entries.map(([key, value]) => `${key}=${value}`).join('&');
};

const buildTencentSig = (pathname: string, params: URLSearchParams, sk: string): string => {
  const sorted = sortSearchParams(params);
  const payload = `${pathname}?${sorted}${sk}`;
  return crypto.createHash('md5').update(payload, 'utf8').digest('hex');
};

const createTencentSecurityProxy = (env: Record<string, string>): Plugin | null => {
  const key = String(env.TENCENT_MAP_KEY || env.VITE_TENCENT_MAP_KEY || '').trim();
  if (!key) return null;

  const sk = String(env.TENCENT_MAP_SK || '').trim();

  return {
    name: 'tencent-map-security-proxy',
    configureServer(server) {
      server.middlewares.use('/_TMapService', async (req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        try {
          const incomingUrl = new URL(req.url, 'http://localhost');
          const incomingPath = incomingUrl.pathname || '/';
          const query = new URLSearchParams(incomingUrl.search);

          let targetHost = '';
          let targetPath = '';

          if (incomingPath === '/' || incomingPath === '') {
            targetHost = 'https://pr.map.qq.com';
            targetPath = '/pingd';
            query.set('appid', query.get('appid') || 'jsapi_v3');
            query.set('key', key);
          } else if (incomingPath === '/checkKey') {
            targetHost = 'https://apikey.map.qq.com';
            targetPath = '/mkey/index.php/mkey/check';
            query.set('key', key);
          } else if (incomingPath.startsWith('/oversea')) {
            targetHost = 'https://overseactrl.map.qq.com';
            targetPath = incomingPath.replace('/oversea', '') || '/';
            query.set('apikey', key);
          } else if (incomingPath.startsWith('/service')) {
            targetHost = 'https://apis.map.qq.com';
            targetPath = `/ws${incomingPath.replace('/service', '')}` || '/ws';
            query.set('key', key);

            if (sk) {
              query.delete('sig');
              query.set('sig', buildTencentSig(targetPath, query, sk));
            }
          } else {
            next();
            return;
          }

          const target = `${targetHost}${targetPath}${query.toString() ? `?${query.toString()}` : ''}`;
          const method = req.method || 'GET';
          const body = method === 'GET' || method === 'HEAD' ? undefined : await collectRequestBody(req);

          const headers = new Headers();
          Object.entries(req.headers).forEach(([headerName, headerValue]) => {
            if (!headerValue) return;
            const lower = headerName.toLowerCase();
            if (lower === 'host' || lower === 'content-length') return;
            if (Array.isArray(headerValue)) {
              headers.set(headerName, headerValue.join(','));
            } else {
              headers.set(headerName, headerValue);
            }
          });

          const upstream = await fetch(target, {
            method,
            headers,
            body,
            redirect: 'manual',
          });

          res.statusCode = upstream.status;
          upstream.headers.forEach((value, name) => {
            if (name.toLowerCase() === 'content-encoding') return;
            res.setHeader(name, value);
          });

          const payload = Buffer.from(await upstream.arrayBuffer());
          res.end(payload);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Tencent proxy error';
          res.statusCode = 502;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ message }));
        }
      });
    },
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const plugins: Plugin[] = [react()];
  const tencentProxy = createTencentSecurityProxy(env);
  if (tencentProxy) plugins.push(tencentProxy);

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});

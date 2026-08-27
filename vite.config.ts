import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Connect } from "vite";
import { defineConfig, type Plugin } from "vite";

/**
 * Serve `/planner`, `/hub` and `/privacy` from their own `index.html`.
 *
 * Vercel resolves directory indexes for us in production, which is why the static
 * guide pages have always worked live. Vite's dev and preview servers do not, so
 * without this every one of those URLs 404s locally — and with the SPA fallback
 * still on, they silently served the rotation planner instead, which is worse.
 */
function directoryIndex(): Plugin {
  let roots: string[] = [];

  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    if (req.method !== "GET" || !req.url) return next();

    const [rawPath, query = ""] = req.url.split("?");
    const path = rawPath.replace(/\/+$/, "");
    // Skip files (anything with an extension), Vite internals and traversal
    if (!path || path.includes(".") || path.startsWith("/@")) return next();

    for (const root of roots) {
      if (existsSync(join(root, path, "index.html"))) {
        // The query has to survive. Supabase confirmation and recovery links
        // arrive as /hub?code=..., and dropping it means the code never reaches
        // the page: no session, and not even the toast explaining why.
        req.url = `${path}/index.html${query ? `?${query}` : ""}`;
        break;
      }
    }
    next();
  };

  return {
    name: "directory-index",
    configResolved(config) {
      roots = config.command === "serve"
        ? [config.root, config.publicDir].filter(Boolean)
        : [resolve(config.root, config.build.outDir)];
    },
    // Added directly rather than returned, so it runs before Vite's own
    // static and HTML middleware rather than after them
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      // Preview resolves its config with the command set to serve, but it is
      // serving the build output rather than the sources. Taking the serve
      // branch above, it only ever found the pages that also exist under
      // `public/` or at the root, so a page the build emits itself came back
      // 404 locally while working in production. That is the wrong way round
      // for a page to fail. Set here rather than sniffed, because this hook
      // runs in preview and nowhere else.
      roots = [resolve(server.config.root, server.config.build.outDir)];
      server.middlewares.use(rewrite);
    },
  };
}

/**
 * Inline CSS into the HTML <head> as a <style> tag.
 * Eliminates the render-blocking stylesheet request — one fewer round-trip.
 *
 * Collection and deletion are two steps on purpose: transformIndexHtml runs once
 * per HTML entry, so deleting an asset there would drop a stylesheet a later
 * page still links to. We only remove assets once every page has been rewritten.
 */
function inlineCss(): Plugin {
  const inlined = new Set<string>();

  return {
    name: "inline-css",
    enforce: "post",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx.bundle) return html;

        // Find CSS assets in the bundle
        for (const [fileName, chunk] of Object.entries(ctx.bundle)) {
          if (!fileName.endsWith(".css") || chunk.type !== "asset") continue;

          const linkTag = new RegExp(
            `<link[^>]+href="/${fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`,
          );
          // This page may not reference this stylesheet — leave it alone if not
          if (!linkTag.test(html)) continue;

          const css = typeof chunk.source === "string"
            ? chunk.source
            : new TextDecoder().decode(chunk.source);

          html = html.replace(linkTag, `<style>${css}</style>`);
          inlined.add(fileName);
        }

        return html;
      },
    },
    generateBundle: {
      // Runs after vite:build-html has emitted every page, so `inlined` is complete
      order: "post",
      handler(_options, bundle) {
        for (const fileName of inlined) delete bundle[fileName];
        inlined.clear();
      },
    },
  };
}

/**
 * Write the rules guides out as static pages a search engine can read.
 *
 * The guide is hub content and stays there, in the bundle, so the Guide tab
 * opens with no signal. But `/hub` is `noindex`, so six guides written from the
 * RFU's own rules of play sit where nothing can find them.
 *
 * Emitted rather than kept in `public/`, because a copy there would be a second
 * source of truth going stale in the repository. Generated at build from
 * `hub/content/guides.ts`, so a page cannot disagree with the guide.
 */
function rulesPagesPlugin(): Plugin {
  return {
    name: "rules-pages",
    apply: "build",
    async generateBundle() {
      // Imported here rather than at the top of the file. `oxlint` loads this
      // config with plain Node, which cannot resolve a `.ts` behind the `.js`
      // specifier the rest of the project uses, so a top level import of it
      // takes out `pnpm lint`. Inside the hook it is only ever reached by Vite,
      // which resolves it the same way it resolves the app.
      const { rulesPages } = await import("./src/seo/rulesPage.js");
      for (const { path, html } of rulesPages()) {
        this.emitFile({
          type: "asset",
          // A directory index, so the URL is `/rugby-rules-u10` with no suffix,
          // matching the drills cluster beside it
          fileName: `${path.replace(/^\//, "")}/index.html`,
          source: html,
        });
      }
    },
  };
}

export default defineConfig({
  root: ".",
  // Not an SPA. Without this, Vite's dev and preview servers rewrite every
  // non-file request to /index.html, so /hub and everything under public/
  // silently serve the rotation planner instead of the page you asked for.
  appType: "mpa",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        // The homepage is static marketing HTML with no bundle of its own.
        home: "index.html",
        planner: "planner/index.html",
        hub: "hub/index.html",
      },
    },
  },
  plugins: [directoryIndex(), rulesPagesPlugin(), inlineCss()],
});

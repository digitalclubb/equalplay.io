import { defineConfig, type Plugin } from "vite";

/**
 * Inline CSS into the HTML <head> as a <style> tag.
 * Eliminates the render-blocking stylesheet request — one fewer round-trip.
 */
function inlineCss(): Plugin {
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
          if (fileName.endsWith(".css") && chunk.type === "asset") {
            const css = typeof chunk.source === "string"
              ? chunk.source
              : new TextDecoder().decode(chunk.source);

            // Replace the <link rel="stylesheet"> with an inline <style>
            html = html.replace(
              new RegExp(`<link[^>]+href="/${fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`),
              `<style>${css}</style>`,
            );

            // Remove the CSS file from the bundle so it's not emitted
            delete ctx.bundle[fileName];
          }
        }

        return html;
      },
    },
  };
}

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
  },
  plugins: [inlineCss()],
});

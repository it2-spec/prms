import { defineConfig } from "vite";
import path from "path";
import pugPlugin from "vite-plugin-pug";
import fs from "fs";
import { renderFile } from "pug";
import chokidar from "chokidar";

const inputDir = path.resolve("assets/pug/pages");
const outputDir = path.resolve("");

/// Compile Pug
const compilePug = filePath => {
  const relativePath = path.relative(inputDir, filePath);
  const outputFilePath = path.resolve(outputDir, relativePath.replace(".pug", ".html"));
  try {
    const html = renderFile(filePath, { pretty: true });
    fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
    fs.writeFileSync(outputFilePath, html);
    console.log(`🟢 Pug compiled: ${filePath} → ${outputFilePath}`);
  } catch (err) {
    console.error(`🔴 Pug error: ${err.message}`);
  }
};

/// Watch Pug Files
const startPugWatcher = () => {
  chokidar
    .watch(inputDir, { persistent: true })
    .on("add", compilePug)
    .on("change", compilePug)
    .on("unlink", filePath => {
      const relativePath = path.relative(inputDir, filePath);
      const outputFilePath = path.resolve(outputDir, relativePath.replace(".pug", ".html"));
      fs.unlink(outputFilePath, () => console.log(`🗑️ Removed: ${outputFilePath}`));
    })
    .on("error", err => console.error(`Watcher error: ${err}`));
};

/// Final Vite Config
export default defineConfig(async ({ command }) => {
  if (command === "serve") {
    startPugWatcher();
  }

  return {
    root: "",
    cacheDir: false,
    server: {
      open: "/template/index.html",
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "assets"),
      },
    },
    plugins: [pugPlugin()],
    css: {
      postcss: "./postcss.config.js",
    },
  };
});

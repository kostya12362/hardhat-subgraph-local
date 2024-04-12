import fs from "fs";
import path from "path";
import { readJsonFile } from "../helpers/utils";
const artifactsDirectory = "./artifacts";
const outputDirectory = "./.extractedAbis";
let whitelist = [
  "Dex223Factory",
  "DexaransNonfungiblePositionManager",
  "ERC223SwapRouter",
  "PoolAddressHelper",
  "ERC223Token",
  "Quoter",
  "QuoterV2",
];

if (!fs.existsSync(outputDirectory)) {
  fs.mkdirSync(outputDirectory);
}

// Функция для извлечения ABI из файла артефакта
function extractABI(filePath: string) {
  const artifact = readJsonFile(filePath);
  fs.writeFileSync(
    path.join(outputDirectory, path.basename(filePath)),
    JSON.stringify(artifact.abi, null, 2)
  );
}

function readDirectoryRecursively(dir: string, fileList: Array<string> = []) {
  const filesAndDirs = fs.readdirSync(dir);

  filesAndDirs.forEach((fileOrDir) => {
    const fullPath = path.join(dir, fileOrDir);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      readDirectoryRecursively(fullPath, fileList); // рекурсивный вызов для поддиректорий
    } else {
      fileList.push(fullPath); // добавление пути файла в массив
    }
  });

  return fileList; // возвращение массива всех файлов
}

// Запуск функции и вывод результатов
const allFiles = readDirectoryRecursively(artifactsDirectory);
allFiles.forEach((file) => {
  if (!file.endsWith(".dbg.json")) {
    const fileName = path.basename(file, ".json"); // Извлекаем название файла без расширения
    if (whitelist.includes(fileName)) {
      // Проверяем, есть ли файл в белом списке
      console.log(`Reading file: ${file}`);
      extractABI(file);
      whitelist = whitelist.filter((item) => item !== fileName);
    }
  }
});

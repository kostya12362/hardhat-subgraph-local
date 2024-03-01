import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";

/**
 * Asynchronous function for obtaining a list of folders in the specified directory.
 * @param {string} searchPath Directory path to search.
 * @returns {Promise<Array<{name: string, path: string}>>} A business that resolves into an array of objects with information about folders.
 */
async function getDirectories(searchPath) {
  try {
    const files = await fs.readdir(searchPath, { withFileTypes: true });
    const directories = files
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => ({
        name: dirent.name,
        path: path.join(searchPath, dirent.name),
      }));
    return directories;
  } catch (err) {
    console.error(`Error reading the directory: ${searchPath}`, err);
  }
}

/**
 * Читает и возвращает содержимое package.json.
 * @param {string} filePath Путь к файлу package.json.
 * @returns {Promise<any>} Промис, возвращающий содержимое package.json в виде объекта.
 */
async function readJson(filePath) {
  try {
    const fileContent = await fs
      .readFile(filePath, "utf8");
    return JSON.parse(fileContent);
  } catch (error) {
    return console.error(`Ошибка при чтении файла ${filePath}:`, error);
  }
}

const runCommand = async ({ command, path = "./", errorMessage = "" }) => {
  return new Promise((resolve, reject) => {
    // Разделяем команду на имя и аргументы
    const [cmd, ...args] = command.split(/\s+/);
    const childProcess = spawn(cmd, args, {
      cwd: path,
      stdio: "inherit", // Наследуем стандартные потоки, чтобы позволить ввод/вывод в реальном времени
      shell: true, // Используем shell для интерпретации команды
    });

    childProcess.on("error", (error) => {
      console.error(errorMessage, error);
      reject(error);
    });

    childProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.error(`${errorMessage}. Exit code: ${code}`);
        reject(new Error(`${errorMessage}. Exit code: ${code}`));
      }
    });
  });
};

export {
  runCommand,
  getDirectories,
  readJson,
};

import fs from "fs"; // Используем промисы для асинхронного чтения
import path from "path";

export function capitalizeFirstLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function readJsonFile(filePath: string) {
  const data = fs.readFileSync(filePath, "utf8");
  return JSON.parse(data);
}

export function getSolFolders(dir: string, folders: string[] = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file.endsWith(".sol")) {
        fs.readdirSync(filePath).forEach((json) => {
          if (!json.endsWith(".dbg.json")) {
            console.log(path.join(filePath, json));
            folders.push(path.join(filePath, json));
          }
        });
      }
      getSolFolders(filePath, folders);
    }
  });

  return folders;
}

export function saveDeployResults(contractDetail: any, artifactsPath: string) {
  const clearPath = (path: string) => {
    const parts = path.split("/");
    const solIndex = parts.findIndex((part) => part.includes(".sol"));
    if (solIndex > -1) {
      parts.splice(solIndex, 1); // Убираем эту часть
    }
    return parts.join("/").replace(artifactsPath, ""); // Собираем путь обратно
  };
  const dir = clearPath(contractDetail.contractFile).replace(/\s/g, "");
  console.log(dir);
  const resultsDirPath = path.join(
    ".",
    "deployments",
    process.env.HARDHAT_NETWORK || "",
    dir
  );
  fs.mkdirSync(resultsDirPath, { recursive: true });
  fs.writeFileSync(
    path.join(resultsDirPath, "result.json"),
    JSON.stringify(contractDetail, null, 2)
  );
}

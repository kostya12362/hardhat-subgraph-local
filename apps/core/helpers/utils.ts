import fs from "fs"; // Используем промисы для асинхронного чтения
import path from "path";

export function capitalizeFirstLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function readJsonFile(filePath: string) {
  const data = fs.readFileSync(filePath, "utf8");
  return JSON.parse(data);
}

export function getContractName(contractFile: string): string {
  if (!contractFile.endsWith(".sol")) {
    throw new Error("Invalid contract file");
  }
  return capitalizeFirstLetter(
    path
      .basename(contractFile, ".sol")
      .toLowerCase()
      .replace(/[.*+?^${}()|[\]\\\/\-_]/g, "")
  );
}

// export const MANAGER = {
//   "auto-listing": {
//     network: process.env.HARDHAT_NETWORK,
//     contracts: {
//       autoListing: {
//         abi: "autoListing.json",
//       },
//     },
//   },
// };

// const subgrapDirPath = path.join(__dirname, "__subgraph__");

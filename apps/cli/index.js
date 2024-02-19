import { exec, spawn } from "child_process";
import { promisify } from "util";

import inquirer from "inquirer";
import path from "path";
import fs from "fs/promises";

const execAsync = promisify(exec);
const SUBGRAPHS_PATH = "../subgraphs";
const DOCKER_PATH = "../../.docker";
const DEPLOY_COFING_PATH = "../core/__subgraph__";

// const runCommand = async ({ command, path = "./", errorMessage = "" }) => {
//   try {
//     const { stdout, stderr } = await execAsync(command, { cwd: path });
//     if (stdout) console.log(stdout); // Логируем стандартный вывод команды
//     if (stderr) console.error(stderr); // Логируем ошибки команды
//   } catch (error) {
//     if (errorMessage) {
//       console.error(`${errorMessage}`, error);
//     } else {
//       console.error(error);
//     }
//   }
// };

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

// return new Promise((resolve, reject) => {
//   const process = spawn(command, args, {
//     cwd: path,
//     stdio: "inherit",
//     shell: true,
//   });

//   process.on("close", (code) => {
//     if (code === 0) {
//       resolve();
//     } else {
//       console.error(errorMessage);
//       reject(new Error(`${errorMessage}. Exit code: ${code}`));
//     }
//   });
// });

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

async function deployContracts() {
  try {
    await runCommand({ command: "yarn workspace core hardhat:compile" });
    await runCommand({ command: "yarn workspace core hardhat:deploy:local" });
    console.log("🚀", "Contracts deployed successfully");
  } catch (error) {
    console.error(`Error when executing the deploy command: ${error}`);
  }
}

async function copyConfigAndABIs() {
  const directories = await getDirectories(DEPLOY_COFING_PATH);
  if (!directories) {
    console.error("No folders with config.json and ABIs found");
    return;
  }
  const directoryNames = directories.map((directory) => directory.name);
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Select the folder with config.json and ABIs to copy:",
      choices: directoryNames,
    },
  ]);
  const core = directories.find(
    (directory) => directory.name === answers.action
  );
  await runCommand({
    command: `cp -r ${core.path}/abis ${SUBGRAPHS_PATH}/${core.name}`,
    errorMessage: "Error when copying abis files",
  });
  await runCommand({
    command: `cp ${core.path}/config.json ${SUBGRAPHS_PATH}/${core.name}/config.json`,
    errorMessage: "Error when copying the config.json",
  });
  await runCommand({
    command: `yarn workspace ${core.name} codegen`,
    errorMessage: "Error when generating the subgraph",
  });
  await runCommand({
    command: `yarn workspace ${core.name} codegen`,
    errorMessage: "Error when generating the subgraph",
  });
  await runCommand({
    command: `yarn workspace ${core.name} create:local`,
    errorMessage: "Error when generating the subgraph",
  });
  await runCommand({
    command: `yarn workspace ${core.name} deploy:local`,
    errorMessage: "Error when generating the subgraph",
  });
}

async function deployDocker() {
  const options = { cwd: DOCKER_PATH };
  await runCommand({
    command: "docker-compose -f docker-compose-dev.yml up -d --build",
    errorMessage: "Error setup docker",
    path: DOCKER_PATH,
  });
}

async function main() {
  console.log("\n");
  const menu = [
    "Deploy contracts",
    "Generation of subgraph templates",
    "Setup docker",
    "Exit",
  ];
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What do you want to do?",
      choices: menu,
    },
  ]);
  switch (answers.action) {
    case menu[0]:
      await deployContracts();
      break;
    case menu[1]:
      await copyConfigAndABIs();
      break;
    case menu[2]:
      await deployDocker();
      break;
    case menu[3]:
      process.exit(0);
    default:
      console.log("Undefind action.");
      break;
  }
  await main();
}

main().catch(console.error);

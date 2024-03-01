// import inquirer from "inquirer";
// import {
//   runCommand,
//   getDirectories,
//   readJson,
//   // findAndReadPackageJsons,
// } from "./utils.js";
// import path from "path";
// import fs from "fs/promises";

// const SUBGRAPHS_PATH = "../subgraphs";
// const DOCKER_PATH = "../../.docker";
// const DEPLOY_COFING_PATH = "../core/__results__";

// async function deployContracts() {
//   try {
//     await runCommand({ command: "yarn workspace core hardhat:compile" });
//     await runCommand({ command: "yarn workspace core hardhat:deploy:local" });
//     console.log("🚀", "Contracts deployed successfully");
//   } catch (error) {
//     console.error(`Error when executing the deploy command: ${error}`);
//   }
// }

// async function copyConfigAndABIs() {
//   // const directories = await getDirectories(DEPLOY_COFING_PATH);
//   // if (!directories) {
//   //   console.error("No folders with config.json and ABIs found");
//   //   return;
//   // }
//   const subgraphDirectories = await getDirectories(SUBGRAPHS_PATH);
//   const subgraphNames = await Promise.all(
//     subgraphDirectories.map(async (dir) => {
//       const packagePath = path.join(dir.path, "package.json");
//       const packageJson = await readJson(packagePath);
//       return packageJson.name;
//     })
//   );

//   const answers = await inquirer.prompt([
//     {
//       type: "list",
//       name: "action",
//       message: "Select the folder with config.json and ABIs to copy:",
//       choices: subgraphNames,
//     },
//   ]);
//   const selectedSubgraph = subgraphDirectories.find(
//     (dir) => dir.name === answers.action
//   );
//   const abisPath = path.join(selectedSubgraph.path, "abis");

//   // Создаем папку abis, если она не существует
//   await fs.mkdir(abisPath, { recursive: true });

//   const templatePath = path.join(
//     selectedSubgraph.path,
//     "subgraph.template.yaml"
//   );
//   const template = await fs.readFile(templatePath, "utf8");

//   const regex = /{{contracts\.([^}.]+)\./g;
//   const uniqueContracts = new Set();
//   let match;

//   while ((match = regex.exec(template)) !== null) {
//     uniqueContracts.add(match[1]);
//   }

//   let network = null;
//   const contractsConfig = {};

//   for (const contractName of uniqueContracts) {
//     const contractPath = path.join(DEPLOY_COFING_PATH, contractName);
//     try {
//       const abiPath = path.join(contractPath, `${contractName}.json`);
//       const resultPath = path.join(contractPath, "result.json");
//       const result = JSON.parse(await fs.readFile(resultPath, "utf8"));

//       // Копирование ABI файла в папку abis
//       await fs.copyFile(abiPath, path.join(abisPath, `${contractName}.json`));

//       // Проверка сети
//       if (network === null) {
//         network = result.network;
//       } else if (network !== result.network) {
//         throw new Error(
//           "Mismatching network configurations found among contracts."
//         );
//       }

//       contractsConfig[contractName] = {
//         abi: `${contractName}.json`,
//         address: result.contractAddress,
//         startBlock: result.startBlock || 1,
//         contractName: result.contractName,
//         contractFile: result.contractFile,
//       };
//     } catch (error) {
//       console.error(`Error processing contract ${contractName}: ${error}`);
//     }
//   }

//   const config = {
//     network,
//     contracts: contractsConfig,
//   };

//   // Сохраняем config.json
//   const configPath = path.join(selectedSubgraph.path, "config.json");
//   await fs.writeFile(configPath, JSON.stringify(config, null, 2));

//   console.log(
//     `Config and ABIs for ${selectedSubgraph.name} created and copied successfully.`
//   );

//   await runCommand({
//     command: `yarn workspace ${selectedSubgraph.name} compile`,
//     errorMessage: "Error when generating the subgraph",
//   });
//   await runCommand({
//     command: `yarn workspace ${selectedSubgraph.name} create:local`,
//     errorMessage: "Error when generating the subgraph",
//   });
//   await runCommand({
//     command: `yarn workspace ${selectedSubgraph.name} deploy:local`,
//     errorMessage: "Error when generating the subgraph",
//   });
// }

// async function setupFakeData() {
//   await runCommand({ command: "yarn workspace core hardhat:setup:data:local" });
// }

// async function deployDocker() {
//   await runCommand({
//     command: "docker-compose -f docker-compose-dev.yml up -d --build",
//     errorMessage: "Error setup docker",
//     path: DOCKER_PATH,
//   });
// }

// async function main() {
//   console.log("\n");
//   // let x = await getDirectories(SUBGRAPHS_PATH);
//   // const directories = await getDirectories(DEPLOY_COFING_PATH);
//   // console.log("Directories:", directories);
//   // for (let i in x) {
//   //   let packageObj = await readJson(path.join(x[i].path, "package.json"));
//   //   console.log("Package:", packageObj.name);
//   //   let template = await fs.readFile(
//   //     path.join(x[i].path, "subgraph.template.yaml"),
//   //     "utf8"
//   //   );
//   //   const regex = /{{contracts\.([^}.]+)\./g;
//   //   const uniqueValues = new Set();
//   //   let match;

//   //   while ((match = regex.exec(template)) !== null) {
//   //     uniqueValues.add(match[1]);
//   //   }
//   //   const uniqueValuesArray = Array.from(uniqueValues);
//   //   // configFile = new Object();
//   //   let results = new Array();
//   //   for (i in directories) {
//   //     if (uniqueValuesArray.includes(directories[i].name)) {
//   //       console.log(directories[i].name);
//   //       let result = await readJson(
//   //         path.join(directories[i].path, "result.json")
//   //       );
//   //       // configFile[directories[i].name] =
//   //     }
//   //   }
//   // }
//   const menu = [
//     "Deploy contracts",
//     "Generation of subgraph templates",
//     "Setup docker (only local)",
//     "Setup fake data (only local)",
//     "Exit",
//   ];
//   const answers = await inquirer.prompt([
//     {
//       type: "list",
//       name: "action",
//       message: "What do you want to do?",
//       choices: menu,
//     },
//   ]);
//   switch (answers.action) {
//     case menu[0]:
//       await deployContracts();
//       break;
//     case menu[1]:
//       await copyConfigAndABIs();
//       break;
//     case menu[2]:
//       await deployDocker();
//       break;
//     case menu[3]:
//       await setupFakeData();
//       break;
//     case menu[4]:
//       process.exit(0);
//     default:
//       console.log("Undefind action.");
//       break;
//   }
//   await main();
// }

// main().catch(console.error);

import inquirer from "inquirer";
import path from "path";
import fs from "fs/promises";
import { runCommand, getDirectories, readJson } from "./utils.js";

const SUBGRAPHS_PATH = "../subgraphs";
const DOCKER_PATH = "../../.docker";
const DEPLOY_CONFIG_PATH = "../core/__results__";

// Функция для деплоя контрактов
async function deployContracts() {
  try {
    await runCommand({ command: "yarn workspace core hardhat:compile" });
    await runCommand({ command: "yarn workspace core hardhat:deploy:local" });
    console.log("🚀 Contracts deployed successfully");
  } catch (error) {
    console.error(`Error during contract deployment: ${error}`);
  }
}

// Функция для копирования конфигурации и ABI
async function copyConfigAndABIs() {
  const subgraphDirectories = await getDirectories(SUBGRAPHS_PATH);
  const subgraphChoices = subgraphDirectories.map((dir) => dir.name);

  const { selectedSubgraphName } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedSubgraphName",
      message: "Select the subgraph to configure:",
      choices: subgraphChoices,
    },
  ]);

  const selectedSubgraph = subgraphDirectories.find(
    (dir) => dir.name === selectedSubgraphName
  );
  await processSubgraph(selectedSubgraph);
}

// Обработка выбранного сабграфа
async function processSubgraph(selectedSubgraph) {
  const abisPath = path.join(selectedSubgraph.path, "abis");
  await fs.mkdir(abisPath, { recursive: true });

  const contractsConfig = await generateContractsConfig(
    selectedSubgraph,
    abisPath
  ); // Изменено: добавлен аргумент abisPath

  // Сохранение config.json
  const configPath = path.join(selectedSubgraph.path, "config.json");
  await fs.writeFile(configPath, JSON.stringify(contractsConfig, null, 2));

  console.log(
    `Config and ABIs for ${selectedSubgraph.name} created and copied successfully.`
  );

  // Компиляция и деплой сабграфа
  await compileAndDeploySubgraph(selectedSubgraph.name);
}

// Генерация конфигурации контрактов
async function generateContractsConfig(selectedSubgraph, abisPath) {
  const templatePath = path.join(
    selectedSubgraph.path,
    "subgraph.template.yaml"
  );
  const template = await fs.readFile(templatePath, "utf8");
  const regex = /{{contracts\.([^}.]+)\./g;
  let match;
  const contractsConfig = { network: null, contracts: {} };

  while ((match = regex.exec(template)) !== null) {
    const contractName = match[1];
    const contractPath = path.join(DEPLOY_CONFIG_PATH, contractName);

    const result = await readJson(path.join(contractPath, "result.json"));

    if (contractsConfig.network === null) {
      contractsConfig.network = result.network;
    } else if (contractsConfig.network !== result.network) {
      throw new Error(
        "Mismatching network configurations found among contracts."
      );
    }

    contractsConfig.contracts[contractName] = {
      abi: `${contractName}.json`,
      address: result.contractAddress,
      startBlock: result.startBlock || 1,
      contractName: result.contractName,
      contractFile: result.contractFile,
    };

    // Копирование ABI
    await fs.copyFile(
      path.join(contractPath, `${contractName}.json`),
      path.join(abisPath, `${contractName}.json`)
    );
  }

  return contractsConfig;
}

// Компиляция и деплой сабграфа
async function compileAndDeploySubgraph(subgraphName) {
  await runCommand({ command: `yarn workspace ${subgraphName} compile` });
  await runCommand({ command: `yarn workspace ${subgraphName} create:local` });
  await runCommand({ command: `yarn workspace ${subgraphName} deploy:local` });
}

// Настройка фейковых данных
async function setupFakeData() {
  await runCommand({ command: "yarn workspace core hardhat:setup:data:local" });
}

// Деплой Docker
async function deployDocker() {
  await runCommand({
    command: "docker-compose -f docker-compose-dev.yml up -d --build",
    path: DOCKER_PATH,
  });
}

// Главное меню
async function main() {
  const actions = {
    "Deploy contracts": deployContracts,
    "Copy config & ABIs to subgraph": copyConfigAndABIs,
    "Setup fake data": setupFakeData,
    "Deploy Docker containers": deployDocker,
    Exit: () => process.exit(0), // Добавлена опция выхода
  };

  while (true) {
    // Изменено: добавлен бесконечный цикл для повторного отображения меню после выполнения действия
    const { selectedAction } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedAction",
        message: "What do you want to do?",
        choices: [...Object.keys(actions), new inquirer.Separator(), "Exit"], // Добавлена опция выхода в список
      },
    ]);

    const action = actions[selectedAction];
    if (action) {
      await action();
    } else {
      console.log("Invalid action selected.");
    }

    if (selectedAction === "Exit") break; // Выход из цикла, если выбрана опция выхода
  }
}

main().catch(console.error);

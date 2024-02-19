#!/bin/bash

# ================== Variables ==================
BASE_DIR=${PWD}
network="local"

subgraphConfigFileName="config.json"
aibsDirName="abis"

CORE_DIR="${BASE_DIR}/dex223-core"
SUBGRAPH_MAIN_DIR="${BASE_DIR}/dex223-subgraphs"
SUBGRAPHS_DIR="${BASE_DIR}/dex223-subgraphs/subgraphs"
SERVICES_DIR="${BASE_DIR}/docker"
SUBGRAPH_PATH_HARDHAT="${CORE_DIR}/scripts/__subgraph__"
# ================== Variables end ===============



# ================== Styles ==================
### Text styles
# echoRed() { echo -e "\e[31m$1\e[0m"; }
# echoGreen() { echo -e "\e[32m$1\e[0m"; }
# echoBold() { echo -e "\e[1m$1\e[0m"; }

echoRed() { echo -e "$1"; }
echoGreen() { echo -e "$1"; }
echoBold() { echo -n "$1"; }

# ================== Styles end ===============


# ================== Functions tools ==================

### Parsing command line arguments
while [ "$#" -gt 0 ]; do
  case "$1" in
    --network)
      network="$2"
      shift 2
      ;;
    *)
      echoRed "Not valid argument: $1"
      exit 1
      ;;
  esac
done

### Function to obfuscate and display the current value of the variable
obfuscate_and_display() {
  local value="${1}"
  if [ ${#value} -le 4 ]; then
    echo "$value"
  else
    local obfuscated="$(echo "$value" | cut -c1-4)$(echo "$value" | cut -c5- | sed 's/./\*/g')"
    echo "$obfuscated"
  fi
}

### Function for managing environment variables
manage_env_vars() {
  local env_file="${PWD}/.env"
  local env_vars=("$@")

  # Check if the file is .env and create it if it is missing
  if [ ! -f "$env_file" ]; then
    echoGreen "========= File $env_file not found. Created... ========="
    touch "$env_file"
  fi

  for var in "${env_vars[@]}"; do
    if ! grep -q "^$var=" "$env_file"; then
      echo "$var не найден."
      echo "Enter a value for $(echoBold "$(echoGreen "$var:")")"
      read var_value
      while [ -z "$var_value" ]; do
        echo "$(echoBold "$(echoRed "$var")") cannot be empty. Please enter the value again:"
        read var_value
      done
      echo "$var=$var_value" >> "$env_file"
      echo "Value $var updated."
    else
      local current_value=$(grep "^$var=" "$env_file" | cut -d'=' -f2-)
      echo "$(echoBold "$(echoGreen "$var")")=$(obfuscate_and_display "$current_value")"
    fi
  done
}

# ================== Functions tools end ===============



# ================== Functions choice subgraph ==================

### Function to display the list of folders and to select the user
chooseSubgraphDirectory() {
  local subgraph_dir="${SUBGRAPH_PATH_HARDHAT}"
  cd "$subgraph_dir"
  echo "Select the folder for the file:"

  local dirs=($(ls -d */))
  for i in "${!dirs[@]}"; do
    local dir_name=$(echo "${dirs[i]}" | sed 's/\/$//')
    echo "$((i+1))) $dir_name"
  done

  local choice
  read -p "Enter the folder number: " choice
  cd - > /dev/null

  if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt "${#dirs[@]}" ]; then
    echoRed "Wrong selection. Shutdown..."
    exit 1
  fi

  # Delete Slash and Update Global Variable
  chosen_dir=$(echo "${dirs[$((choice-1))]}" | sed 's/\/$//')
  echo "========= The selected folder is: "$(echoBold "$(echoGreen "$chosen_dir")")
  deploySubgraphFiles $chosen_dir
}


### Copy ABIs and config.json to the subgraph directory

deploySubgraphFiles() {
  if [ -z "$chosen_dir" ]; then
    echoRed "No subgraph selected. Please select a directory."
    return
  fi
  
  local source_abi_dir="${SUBGRAPH_PATH_HARDHAT}/$chosen_dir/${aibsDirName}"
  local target_abi_dir="${SUBGRAPHS_DIR}/$chosen_dir/${aibsDirName}"
  local source_config_file="${SUBGRAPH_PATH_HARDHAT}/$chosen_dir/${subgraphConfigFileName}"
  local target_config_dir="${SUBGRAPHS_DIR}/$chosen_dir"
  cd $target_config_dir
  echo "========= Directory: $(echoBold "${target_config_dir}") ========="
  yarn install
  # Create target directories if they do not exist
  mkdir -p "$target_abi_dir" "$target_config_dir"

  # Copy ABIs if directory exists
  if [ -d "$source_abi_dir" ]; then
    cp -r "$source_abi_dir"/* "$target_abi_dir"
    echo "========= Directory $(echoBold "${aibsDirName}") copys."
  else
    echo "========= Directory with $(echoBold "${aibsDirName}") not found: $(echoRed "$source_abi_dir")"
  fi

  # Check if config.json file exists, if not, create it
  if [ ! -f "$source_config_file" ]; then
    echo "File $(echoBold "${subgraphConfigFileName}") not found: $(echoRed "$source_config_file")"
    # Create base config.json, if you want to add specific data, modify here
    echo "{}" > "$source_config_file"
    echo "File $(echoBold "${subgraphConfigFileName}") created."
  fi

  # Copy config.json
  cp "$source_config_file" "$target_config_dir"
  echo "File $(echoBold "${subgraphConfigFileName}") copys."
}

# ================== Functions choice subgraph end ===============



# ================== Functions deploy subgraph ==================
initializeSubgraph() {
  if [ -z "$chosen_dir" ]; then
    echoRed "No directory selected. Please select a directory."
    return
  fi
  echo "Initializing subgraph..."
  # cd $SUBGRAPH_MAIN_DIR
  # yarn install
  cd ${SUBGRAPHS_DIR}/$chosen_dir
  echo "========= Directory: $(echoBold "${SUBGRAPHS_DIR}/$chosen_dir") ========="
  yarn install
  yarn compile
  if [ "$network" = "local" ]; then
    yarn create:local
    yarn deploy:local
  fi
  echoGreen "Subgraph successfully initialized."
}
# ================== Functions deploy subgraph end ==================

# ================== Functions setup random data to subgraph ==================
initializeSubgraphData() {
  if [ -z "$chosen_dir" ]; then
    echoRed "No directory selected. Please select a directory."
    return
  fi
  echo "- Setup data to subgraph"
  cd ${CORE_DIR}
  if [[ "$network" == "local" ]]; then
    yarn hardhat:setup:local
  fi
}
# ================== Functions setup random data to subgraph end ===============


setupCore() {
  cd ${CORE_DIR}
  echo "- Setup dex223-core"
  manage_env_vars INFURA_API_KEY ETHERSCAN_API_KEY MNEMONIC
  yarn install
  if [[ "$network" == "local" ]]; then
    nohup yarn hardhat:node > hardhat-node.log 2>&1 &
  fi
  yarn hardhat:compile
  echo "========= Deploy to network: $(echoBold "$(echoGreen "$network")") ========="
  yarn hardhat:deploy:${network}
  echo "========= Finish deploy to network: $(echoBold "$(echoGreen "$network")") ========="

}

setupServices() {
  if [[ "$network" == "local" ]]; then
    echo "- Setup dex223-services"
    cd "${SERVICES_DIR}"
    manage_env_vars POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB
    docker-compose up -d --build
  fi
}

# Main menu for actions
mainMenu() {
  while true; do
    echo "--------------------------------"
    PS3='Please select an action: '
    options=("Choose subgraph directory" "Initialize subgraph" "Initialize Subgraph Data" "Exit")
    select opt in "${options[@]}"; do
      case $REPLY in
        1)
          chooseSubgraphDirectory
          break
          ;;
        2)
          initializeSubgraph
          break
          ;;
        3)
          initializeSubgraphData
          echo "Returning to main menu..."
          break
          ;;
        4)
          echo "Exiting..."
          return
          ;;
        *)
          echoRed "Invalid option: $REPLY"
          break
          ;;
      esac
    done
  done
}

echo "========= $(echoBold "root dir"): ${BASE_DIR} ========="
setupCore
setupServices
mainMenu


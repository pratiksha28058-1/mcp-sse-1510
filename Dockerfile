FROM node:20-bullseye

ENV DEBIAN_FRONTEND=noninteractive
ENV DOTNET_SYSTEM_NET_HTTP_USESOCKETSHTTPHANDLER=0

# Install dependencies
RUN apt-get update && \
    apt-get install -y wget apt-transport-https software-properties-common curl jq ca-certificates git dos2unix && \
    update-ca-certificates && \
    # Install PowerShell
    wget -q https://packages.microsoft.com/config/debian/11/packages-microsoft-prod.deb && \
    dpkg -i packages-microsoft-prod.deb && \
    apt-get update && \
    apt-get install -y powershell && \
    # Install GitHub CLI
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && \
    apt-get install -y gh && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN git config --global http.sslVerify false

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev
COPY . .

RUN chmod +x ./scripts/*.sh && find ./scripts -type f -name "*.sh" -exec dos2unix {} \;

# Entrypoint for runtime login & extension install
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
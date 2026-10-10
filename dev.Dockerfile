# VS Code Development Dockerfile for the CRG Stream Deck plugin
# Base image, pinned by digest so every developer builds the same one
# mcr.microsoft.com/devcontainers/typescript-node:24-bookworm
FROM mcr.microsoft.com/devcontainers/typescript-node@sha256:cba90c28e53ac2f5a8a5a0388b71b8e98bbe1a4711e0faaa6ef48b137037d4ae

# Node.js 24 is the runtime the plugin manifest asks Stream Deck for.
# Only pre-commit is missing from the base image.

# Set the working directory
WORKDIR /workspaces/crg-streamdeck-plugin

# Install pre-commit, which runs the gitleaks secret scan before a
# commit is written. The base image ships Python without pip and marks
# the interpreter as externally managed, so pre-commit gets its own
# virtual environment rather than the system site packages.
RUN apt-get update && \
    apt-get install --no-install-recommends -y python3-venv && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    python3 -m venv /opt/pre-commit && \
    /opt/pre-commit/bin/pip install --no-cache-dir pre-commit && \
    ln -s /opt/pre-commit/bin/pre-commit /usr/local/bin/pre-commit && \
    pre-commit --version

# Start the bash prompt
CMD ["/bin/bash"]

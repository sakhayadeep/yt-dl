function getExecutableName() {
    let executableName;
    // return a platform-specific executable name
    switch (process.platform) {
        case "win32":
            executableName = "main.exe";
            break;
        case "darwin":
            executableName = "main"; // mac
            break;
        case "linux":
            executableName = "main"; // linux
            break;
    }

    return executableName || 'main';
}

module.exports = getExecutableName;

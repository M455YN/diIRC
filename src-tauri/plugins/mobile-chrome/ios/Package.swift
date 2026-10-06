// swift-tools-version:5.5
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "tauri-plugin-mobile-chrome",
    platforms: [
        .macOS(.v10_13),
        .iOS(.v15),
    ],
    products: [
        .library(
            name: "tauri-plugin-mobile-chrome",
            type: .static,
            targets: ["tauri-plugin-mobile-chrome"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-mobile-chrome",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources")
    ]
)

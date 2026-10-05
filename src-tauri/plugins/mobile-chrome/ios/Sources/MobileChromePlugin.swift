import SwiftRs
import SwiftUI
import Tauri
import UIKit
import WebKit

class TabBarItemArgs: Decodable {
  let id: String
  let label: String
}

class ConfigureTabBarArgs: Decodable {
  let items: [TabBarItemArgs]
  let selectedId: String
  let visible: Bool?
}

class SetTabBarSelectedArgs: Decodable {
  let id: String
}

class SetTabBarVisibleArgs: Decodable {
  let visible: Bool
}

class MobileChromePlugin: Plugin {
  private weak var webview: WKWebView?
  private var hostController: UIHostingController<AnyView>?
  private var overlayView: PassthroughOverlayView?

  private var items: [TabBarItemModel] = []
  private var selectedId: String = "chats"
  private var visible: Bool = true

  @objc public override func load(webview: WKWebView) {
    self.webview = webview
    DispatchQueue.main.async {
      if !self.items.isEmpty {
        self.ensureOverlay()
        self.refreshOverlay()
      }
    }
  }

  @objc public func configureTabBar(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(ConfigureTabBarArgs.self)
    DispatchQueue.main.async {
      self.items = args.items.map { TabBarItemModel(id: $0.id, label: $0.label) }
      self.selectedId = args.selectedId
      self.visible = args.visible ?? true
      self.ensureOverlay()
      // WebView may not be attached yet; retry once shortly after.
      if self.overlayView == nil {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
          self.ensureOverlay()
          self.refreshOverlay()
        }
      }
      self.refreshOverlay()
      invoke.resolve([
        "native": true,
        "bottomInset": self.bottomInsetCssPx(),
      ])
    }
  }

  @objc public func setTabBarSelected(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SetTabBarSelectedArgs.self)
    DispatchQueue.main.async {
      self.selectedId = args.id
      self.refreshOverlay()
      invoke.resolve()
    }
  }

  @objc public func setTabBarVisible(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SetTabBarVisibleArgs.self)
    DispatchQueue.main.async {
      self.visible = args.visible
      self.refreshOverlay()
      invoke.resolve()
    }
  }

  @objc public func getTabBarInsets(_ invoke: Invoke) throws {
    DispatchQueue.main.async {
      let bottom = (self.visible && !self.items.isEmpty) ? self.bottomInsetCssPx() : 0.0
      invoke.resolve(["bottom": bottom])
    }
  }

  private func ensureOverlay() {
    guard let webview = webview, let parent = webview.superview else { return }
    if overlayView != nil { return }

    let overlay = PassthroughOverlayView(frame: parent.bounds)
    overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    overlay.backgroundColor = .clear
    overlay.isUserInteractionEnabled = true

    let root = AnyView(self.makeBarView())
    let host = UIHostingController(rootView: root)
    host.view.backgroundColor = .clear
    host.view.frame = overlay.bounds
    host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    host.view.isOpaque = false

    overlay.addSubview(host.view)
    parent.addSubview(overlay)

    self.overlayView = overlay
    self.hostController = host
  }

  private func refreshOverlay() {
    guard let host = hostController, let overlay = overlayView else { return }
    host.rootView = AnyView(makeBarView())
    let show = visible && !items.isEmpty
    overlay.isHidden = !show
    overlay.isUserInteractionEnabled = show
  }

  private func makeBarView() -> some View {
    Group {
      if visible && !items.isEmpty {
        FloatingTabBarView(
          items: items,
          selectedId: selectedId,
          onSelect: { [weak self] id in
            guard let self = self else { return }
            self.selectedId = id
            self.refreshOverlay()
            self.trigger("tab-selected", data: ["id": id])
          }
        )
      } else {
        EmptyView()
      }
    }
  }

  private func bottomInsetCssPx() -> Double {
    let safeBottom = webview?.safeAreaInsets.bottom
      ?? UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .flatMap { $0.windows }
        .first { $0.isKeyWindow }?
        .safeAreaInsets.bottom
      ?? 0
    // 65pt bar + 12pt padding + safe area
    return 65.0 + 12.0 + Double(safeBottom)
  }
}

/// Forwards touches outside the bottom pill band to the WebView underneath.
final class PassthroughOverlayView: UIView {
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    let bandTop = bounds.height - 140
    if point.y < bandTop {
      return nil
    }
    return super.hitTest(point, with: event)
  }
}

@_cdecl("init_plugin_mobile_chrome")
func initPlugin() -> Plugin {
  return MobileChromePlugin()
}

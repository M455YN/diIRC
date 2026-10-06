import SwiftUI

struct TabBarItemModel: Identifiable, Equatable {
  let id: String
  let label: String
}

struct FloatingTabBarView: View {
  let items: [TabBarItemModel]
  let selectedId: String
  let onSelect: (String) -> Void

  var body: some View {
    VStack {
      Spacer()
      HStack(spacing: 0) {
        ForEach(items) { item in
          Button {
            onSelect(item.id)
          } label: {
            VStack(spacing: 2) {
              Image(systemName: iconName(for: item.id))
                .font(.system(size: 20, weight: .regular))
              Text(item.label)
                .font(.system(size: 11, weight: .semibold))
            }
            .foregroundStyle(item.id == selectedId ? Color.accentColor : Color.primary.opacity(0.75))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background {
              if item.id == selectedId {
                Capsule()
                  .fill(Color.white.opacity(0.35))
                  .padding(.horizontal, 4)
                  .padding(.vertical, 4)
              }
            }
          }
          .buttonStyle(.plain)
        }
      }
      .padding(.horizontal, 6)
      .frame(height: 65)
      .modifier(LiquidGlassCapsule())
      .overlay(
        Capsule()
          .strokeBorder(Color.white.opacity(0.45), lineWidth: 1)
      )
      .shadow(color: Color.black.opacity(0.28), radius: 20, y: 8)
      .padding(.horizontal, 20)
      .padding(.bottom, 12)
    }
    .allowsHitTesting(true)
  }

  private func iconName(for id: String) -> String {
    switch id {
    case "servers": return "externaldrive.connected.to.line.below"
    case "chats": return "bubble.left.and.bubble.right"
    case "more": return "ellipsis"
    default: return "circle"
    }
  }
}

private struct LiquidGlassCapsule: ViewModifier {
  func body(content: Content) -> some View {
    if #available(iOS 26.0, *) {
      content.glassEffect(.regular, in: .capsule)
    } else {
      content.background(.ultraThinMaterial, in: Capsule())
    }
  }
}

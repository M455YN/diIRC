import { useState, useRef } from "react";
import { Settings, ShieldCheck } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ActionTooltip } from "@/components/action-tooltip";
import { useMockStore } from "@/lib/mock-store";
import { useModal } from "@/hooks/use-modal-store";

import { NavigationAction } from "./navigation-action";
import { NavigationItem } from "./navigation-item";

export const NavigationSidebar = () => {
  const servers = useMockStore((state) => state.servers);
  const reorderServers = useMockStore((state) => state.reorderServers);
  const { onOpen } = useModal();

  const [draggedServerId, setDraggedServerId] = useState<string | null>(null);
  const [dragOverServerId, setDragOverServerId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"above" | "below" | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  const dragRef = useRef<{
    activeId: string;
    sourceIndex: number;
    startY: number;
    isDragging: boolean;
  } | null>(null);

  const findTargetServer = (
    clientX: number,
    clientY: number,
    activeId: string
  ): { targetId: string; position: "above" | "below" } | null => {
    const sidebarEl = document.querySelector<HTMLElement>("[data-sidebar='navigation']");
    if (sidebarEl) {
      const rect = sidebarEl.getBoundingClientRect();
      if (clientX < rect.left - 30 || clientX > rect.right + 30) {
        return null;
      }
    }

    const sourceIndex = servers.findIndex((s) => s.id === activeId);
    if (sourceIndex === -1) return null;

    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-server-id]"));
    const otherItems = items.filter((el) => el.getAttribute("data-server-id") !== activeId);
    if (otherItems.length === 0) return null;

    const itemsWithMid = otherItems.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        id: el.getAttribute("data-server-id")!,
        midY: rect.top + rect.height / 2,
      };
    });

    itemsWithMid.sort((a, b) => a.midY - b.midY);

    const isSamePosition = (targetId: string, position: "above" | "below") => {
      const targetIndex = servers.findIndex((s) => s.id === targetId);
      if (targetIndex === -1) return false;
      let destinationIndex = targetIndex;
      if (sourceIndex < targetIndex) {
        destinationIndex = position === "above" ? targetIndex - 1 : targetIndex;
      } else if (sourceIndex > targetIndex) {
        destinationIndex = position === "above" ? targetIndex : targetIndex + 1;
      }
      return destinationIndex === sourceIndex;
    };

    let target: { targetId: string; position: "above" | "below" } | null = null;

    if (clientY < itemsWithMid[0].midY) {
      target = { targetId: itemsWithMid[0].id, position: "above" };
    } else if (clientY >= itemsWithMid[itemsWithMid.length - 1].midY) {
      const lastItem = itemsWithMid[itemsWithMid.length - 1];
      target = { targetId: lastItem.id, position: "below" };
    } else {
      for (let i = 0; i < itemsWithMid.length - 1; i++) {
        if (clientY >= itemsWithMid[i].midY && clientY < itemsWithMid[i + 1].midY) {
          target = { targetId: itemsWithMid[i + 1].id, position: "above" };
          break;
        }
      }
    }

    if (target && isSamePosition(target.targetId, target.position)) {
      return null;
    }

    return target;
  };

  const handlePointerDown = (e: React.PointerEvent, id: string, index: number) => {
    if (e.button !== 0) return; // only left click
    dragRef.current = {
      activeId: id,
      sourceIndex: index,
      startY: e.clientY,
      isDragging: false,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragRef.current) return;
      const dist = Math.abs(moveEvent.clientY - dragRef.current.startY);
      if (!dragRef.current.isDragging) {
        if (dist > 4) {
          dragRef.current.isDragging = true;
          setDraggedServerId(dragRef.current.activeId);
          setDragPos({ x: moveEvent.clientX, y: moveEvent.clientY });
          document.body.style.userSelect = "none";
          document.body.style.webkitUserSelect = "none";
          document.body.style.cursor = "grabbing";
        } else {
          return;
        }
      }

      moveEvent.preventDefault();
      window.getSelection()?.removeAllRanges();
      setDragPos({ x: moveEvent.clientX, y: moveEvent.clientY });

      const target = findTargetServer(moveEvent.clientX, moveEvent.clientY, dragRef.current.activeId);
      if (target) {
        setDragOverServerId(target.targetId);
        setDropPosition(target.position);
      } else {
        setDragOverServerId(null);
        setDropPosition(null);
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);

      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      document.body.style.cursor = "";
      window.getSelection()?.removeAllRanges();

      const state = dragRef.current;
      dragRef.current = null;

      if (!state || !state.isDragging) {
        setDraggedServerId(null);
        setDragOverServerId(null);
        setDropPosition(null);
        setDragPos(null);
        return;
      }

      const target = findTargetServer(upEvent.clientX, upEvent.clientY, state.activeId);
      if (target) {
        const targetIndex = servers.findIndex((s) => s.id === target.targetId);
        const sourceIndex = state.sourceIndex;
        if (targetIndex !== -1 && sourceIndex !== -1) {
          let destinationIndex = targetIndex;
          if (sourceIndex < targetIndex) {
            destinationIndex = target.position === "above" ? targetIndex - 1 : targetIndex;
          } else if (sourceIndex > targetIndex) {
            destinationIndex = target.position === "above" ? targetIndex : targetIndex + 1;
          }
          if (destinationIndex !== sourceIndex) {
            reorderServers(sourceIndex, destinationIndex);
          }
        }
      }

      setDraggedServerId(null);
      setDragOverServerId(null);
      setDropPosition(null);
      setDragPos(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  return (
    <>
      {draggedServerId && dragPos && (() => {
        const draggedServer = servers.find((s) => s.id === draggedServerId);
        if (!draggedServer) return null;
        return (
          <div
            className="fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 opacity-70 transition-transform scale-105 shadow-2xl"
            style={{ left: dragPos.x, top: dragPos.y }}
          >
            <div className="h-[48px] w-[48px] rounded-[16px] overflow-hidden bg-background dark:bg-neutral-700 ring-2 ring-indigo-500 shadow-indigo-500/40 flex items-center justify-center">
              {draggedServer.imageUrl ? (
                <img
                  src={draggedServer.imageUrl}
                  alt={draggedServer.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-bold text-sm text-zinc-200">
                  {draggedServer.name.substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>
          </div>
        );
      })()}
      <div
        className="space-y-4 flex flex-col items-center h-full text-primary w-full dark:bg-[#1E1F22] bg-[#E3E5E8] py-3 select-none"
      >
        <NavigationAction />
        <Separator
          className="h-[2px] bg-zinc-300 dark:bg-zinc-700 rounded-md w-10 mx-auto"
        />
        <ScrollArea className="flex-1 w-full no-scrollbar">
          <div className="pt-3.5">
            {servers.map((server, index) => (
              <div key={server.id} className="mb-4">
                <NavigationItem
                  id={server.id}
                  name={server.name}
                  imageUrl={server.imageUrl}
                  index={index}
                  isDragging={draggedServerId === server.id}
                  isAnyDragging={!!draggedServerId}
                  dropPosition={dragOverServerId === server.id ? dropPosition : null}
                  onPointerDown={handlePointerDown}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="pb-3 mt-auto flex items-center flex-col gap-y-4">
          <ActionTooltip side="right" align="center" label="Role icons">
            <button
              onClick={() => onOpen("roleIcons")}
              className="group flex items-center justify-center"
            >
              <div className="flex mx-3 h-[48px] w-[48px] rounded-[24px] group-hover:rounded-[16px] transition-all overflow-hidden items-center justify-center bg-background dark:bg-neutral-700 group-hover:bg-emerald-500">
                <ShieldCheck className="text-zinc-500 dark:text-zinc-400 group-hover:text-white transition" size={24} />
              </div>
            </button>
          </ActionTooltip>
          <ActionTooltip side="right" align="center" label="Settings">
            <button
              onClick={() => onOpen("settings")}
              className="group flex items-center justify-center"
            >
              <div className="flex mx-3 h-[48px] w-[48px] rounded-[24px] group-hover:rounded-[16px] transition-all overflow-hidden items-center justify-center bg-background dark:bg-neutral-700 group-hover:bg-indigo-500">
                <Settings className="text-zinc-500 dark:text-zinc-400 group-hover:text-white transition" size={24} />
              </div>
            </button>
          </ActionTooltip>
        </div>
      </div>
    </>
  );
};

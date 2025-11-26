"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Id } from "@/convex/_generated/dataModel";

export interface OpenPostTab {
    postId: Id<"instagram_posts">;
    projectId: Id<"projects">;
    thumbnailUrl: string | null;
    caption: string | null;
}

interface PostTabsContextType {
    openTabs: OpenPostTab[];
    activePostId: Id<"instagram_posts"> | null;
    openPost: (tab: OpenPostTab) => void;
    closePost: (postId: Id<"instagram_posts">) => void;
    setActivePost: (postId: Id<"instagram_posts"> | null) => void;
    closeAllPosts: () => void;
    getTabsForProject: (projectId: Id<"projects">) => OpenPostTab[];
}

const PostTabsContext = createContext<PostTabsContextType | undefined>(undefined);

export function PostTabsProvider({ children }: { children: ReactNode }) {
    const [openTabs, setOpenTabs] = useState<OpenPostTab[]>([]);
    const [activePostId, setActivePostId] = useState<Id<"instagram_posts"> | null>(null);

    const openPost = useCallback((tab: OpenPostTab) => {
        setOpenTabs((prev) => {
            // Check if already open
            const existing = prev.find((t) => t.postId === tab.postId);
            if (existing) {
                // Already open, just set as active
                setActivePostId(tab.postId);
                return prev;
            }
            // Add new tab
            setActivePostId(tab.postId);
            return [...prev, tab];
        });
    }, []);

    const closePost = useCallback((postId: Id<"instagram_posts">) => {
        setOpenTabs((prev) => {
            const newTabs = prev.filter((t) => t.postId !== postId);

            // If we're closing the active tab, switch to another tab or null
            if (activePostId === postId) {
                const currentIndex = prev.findIndex((t) => t.postId === postId);
                // Try to select the next tab, or previous, or null
                const nextTab = newTabs[currentIndex] || newTabs[currentIndex - 1] || null;
                setActivePostId(nextTab?.postId || null);
            }

            return newTabs;
        });
    }, [activePostId]);

    const closeAllPosts = useCallback(() => {
        setOpenTabs([]);
        setActivePostId(null);
    }, []);

    const setActivePost = useCallback((postId: Id<"instagram_posts"> | null) => {
        setActivePostId(postId);
    }, []);

    const getTabsForProject = useCallback((projectId: Id<"projects">) => {
        return openTabs.filter((tab) => tab.projectId === projectId);
    }, [openTabs]);

    return (
        <PostTabsContext.Provider
            value={{
                openTabs,
                activePostId,
                openPost,
                closePost,
                setActivePost,
                closeAllPosts,
                getTabsForProject,
            }}
        >
            {children}
        </PostTabsContext.Provider>
    );
}

export function usePostTabs() {
    const context = useContext(PostTabsContext);
    if (context === undefined) {
        throw new Error("usePostTabs must be used within a PostTabsProvider");
    }
    return context;
}

"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Add01Icon,
    InstagramIcon,
    ArrowRight01Icon,
    Delete02Icon,
    AiMagicIcon,
    FlashIcon,
    UserMultiple02Icon,
    GridViewIcon,
    Loading01Icon,
} from "@hugeicons/core-free-icons";

// Type for project with storage URL (matches backend)
type ProjectWithStorageUrl = Doc<"projects"> & {
    profilePictureStorageUrl: string | null;
};
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Link from "next/link";
import Image from "next/image";

export default function DashboardPage() {
    const projects = useQuery(api.projects.list);
    const createProject = useMutation(api.projects.create);
    const deleteProject = useMutation(api.projects.remove);
    const fetchInstagramProfile = useAction(api.instagram.fetchProfile);

    const [newProjectHandle, setNewProjectHandle] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [deletingProjectId, setDeletingProjectId] = useState<Id<"projects"> | null>(null);

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProjectHandle) return;

        setIsCreating(true);
        try {
            // Clean the handle (remove @ if present)
            const cleanHandle = newProjectHandle.replace(/^@/, "").trim();
            const instagramUrl = `https://instagram.com/${cleanHandle}`;

            const projectId = await createProject({
                name: cleanHandle,
                instagramUrl: instagramUrl,
            });

            await fetchInstagramProfile({
                projectId,
                instagramUrl: instagramUrl,
            });

            setNewProjectHandle("");
        } catch (error) {
            console.error("Failed to create project:", error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteProject = async (projectId: Id<"projects">) => {
        if (deletingProjectId) return;

        setDeletingProjectId(projectId);
        try {
            await deleteProject({ projectId });
        } catch (error) {
            console.error("Failed to delete project:", error);
        } finally {
            setDeletingProjectId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <h1 className="text-lg font-medium tracking-tight">
                        Dashboard
                    </h1>
                    <p className="text-xs text-muted-foreground">
                        Gerencie suas marcas e analises.
                    </p>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-none bg-primary/10 ring-1 ring-primary/20">
                        <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} className="size-3 text-primary" />
                        <span>Powered by AI</span>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="col-span-full md:col-span-1 ring-1 ring-primary/20">
                    <CardHeader>
                        <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-none bg-primary/10 flex items-center justify-center">
                                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-sm">Novo Projeto</CardTitle>
                                <CardDescription className="text-xs">
                                    Adicione uma conta do Instagram
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateProject} className="space-y-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="handle" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                    @ do Instagram
                                </Label>
                                <Input
                                    id="handle"
                                    placeholder="@suamarca"
                                    value={newProjectHandle}
                                    onChange={(e) => setNewProjectHandle(e.target.value)}
                                    disabled={isCreating}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isCreating || !newProjectHandle}>
                                {isCreating ? (
                                    <>
                                        <HugeiconsIcon icon={Loading01Icon} strokeWidth={2} className="size-3.5 animate-spin" />
                                        Criando...
                                    </>
                                ) : (
                                    <>
                                        <HugeiconsIcon icon={FlashIcon} strokeWidth={2} className="size-3.5" />
                                        Criar Projeto
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {projects === undefined ? (
                    // Loading state
                    <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <HugeiconsIcon icon={Loading01Icon} strokeWidth={2} className="size-5 animate-spin mb-3" />
                        <span className="text-xs">Carregando projetos...</span>
                    </div>
                ) : projects.length === 0 ? (
                    // Empty state
                    <div className="col-span-full md:col-span-2 flex flex-col items-center justify-center rounded-none ring-1 ring-foreground/10 p-10 text-center animate-in fade-in-50">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-none bg-primary/10">
                            <HugeiconsIcon icon={InstagramIcon} strokeWidth={2} className="size-6 text-primary" />
                        </div>
                        <h3 className="mt-4 text-sm font-medium">Nenhum projeto ainda</h3>
                        <p className="mb-3 mt-1 text-xs text-muted-foreground max-w-sm">
                            Comece adicionando o @ do Instagram ao lado para iniciar sua primeira analise com IA.
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-primary">
                            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3" />
                            <span>Adicione seu primeiro projeto</span>
                        </div>
                    </div>
                ) : (
                    // Project list
                    projects.map((project: ProjectWithStorageUrl) => (
                        <Card key={project._id} className="group relative overflow-hidden">
                            {/* Profile Picture & Header */}
                            <CardHeader>
                                <div className="flex items-center gap-2.5">
                                    {/* Profile Picture */}
                                    <div className="relative shrink-0">
                                        <div className="h-10 w-10 rounded-none overflow-hidden ring-1 ring-foreground/10 bg-muted">
                                            {project.profilePictureStorageUrl ? (
                                                <Image
                                                    src={project.profilePictureStorageUrl}
                                                    alt={project.name}
                                                    width={40}
                                                    height={40}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center">
                                                    <HugeiconsIcon icon={InstagramIcon} strokeWidth={2} className="size-4 text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                        {/* Online indicator */}
                                        <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-none bg-background ring-1 ring-background flex items-center justify-center">
                                            <div className="h-2 w-2 rounded-none bg-[var(--success)]" />
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <CardTitle className="truncate text-xs">
                                            @{project.instagramHandle || project.name}
                                        </CardTitle>
                                        {project.bio ? (
                                            <CardDescription className="line-clamp-1 text-[10px]">
                                                {project.bio}
                                            </CardDescription>
                                        ) : (
                                            <CardDescription className="truncate text-[10px]">
                                                {project.instagramUrl}
                                            </CardDescription>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-3">
                                {/* Stats */}
                                {(project.followersCount !== undefined || project.postsCount !== undefined) && (
                                    <div className="flex items-center gap-3">
                                        {project.followersCount !== undefined && (
                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                <HugeiconsIcon icon={UserMultiple02Icon} strokeWidth={2} className="size-3" />
                                                <span className="font-medium text-foreground">
                                                    {project.followersCount >= 1000
                                                        ? `${(project.followersCount / 1000).toFixed(1)}k`
                                                        : project.followersCount}
                                                </span>
                                                <span>seguidores</span>
                                            </div>
                                        )}
                                        {project.postsCount !== undefined && (
                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                <HugeiconsIcon icon={GridViewIcon} strokeWidth={2} className="size-3" />
                                                <span className="font-medium text-foreground">{project.postsCount}</span>
                                                <span>posts</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center justify-between pt-2 border-t">
                                    <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                                        {new Date(project.createdAt).toLocaleDateString("pt-BR", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric"
                                        })}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            variant="outline"
                                            size="xs"
                                            asChild
                                        >
                                            <Link href={`/dashboard/projects/${project._id}`}>
                                                Abrir
                                                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3" />
                                            </Link>
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    title="Excluir projeto"
                                                    disabled={deletingProjectId === project._id}
                                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    {deletingProjectId === project._id ? (
                                                        <HugeiconsIcon icon={Loading01Icon} strokeWidth={2} className="size-3 animate-spin" />
                                                    ) : (
                                                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3" />
                                                    )}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Excluir projeto</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Deseja realmente excluir o projeto &quot;{project.name}&quot;? Essa acao nao pode ser desfeita.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleDeleteProject(project._id)}
                                                        variant="destructive"
                                                    >
                                                        Excluir
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            </CardContent>

                            {/* Loading overlay */}
                            {project.isFetching && (
                                <div className="absolute inset-0 bg-background/80 supports-[backdrop-filter]:backdrop-blur-xs flex items-center justify-center">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <HugeiconsIcon icon={Loading01Icon} strokeWidth={2} className="size-4 animate-spin" />
                                        <span>Analisando perfil...</span>
                                    </div>
                                </div>
                            )}
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}

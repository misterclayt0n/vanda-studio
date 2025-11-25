"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
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
import { Plus, Instagram, ArrowRight, Trash, Sparkles, Zap, Users, Grid3X3, ExternalLink } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function DashboardPage() {
    const projects = useQuery(api.projects.list);
    const createProject = useMutation(api.projects.create);
    const deleteProject = useMutation(api.projects.remove);
    const fetchInstagramProfile = useAction(api.instagram.fetchProfile);

    const [newProjectUrl, setNewProjectUrl] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [deletingProjectId, setDeletingProjectId] = useState<Id<"projects"> | null>(null);

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProjectUrl) return;

        setIsCreating(true);
        try {
            // Simple name extraction for now
            const name = newProjectUrl.split("/").filter(Boolean).pop() || "Novo Projeto";

            const projectId = await createProject({
                name: name,
                instagramUrl: newProjectUrl,
            });

            await fetchInstagramProfile({
                projectId,
                instagramUrl: newProjectUrl,
            });

            setNewProjectUrl("");
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
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold tracking-tight">
                        <span className="text-gradient">Dashboard</span>
                    </h1>
                    <p className="text-muted-foreground">
                        Gerencie suas marcas e análises.
                    </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <span>Powered by AI</span>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="col-span-full md:col-span-1 border-dashed border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-purple flex items-center justify-center shadow-lg shadow-primary/20">
                                <Plus className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <CardTitle>Novo Projeto</CardTitle>
                                <CardDescription>
                                    Adicione uma conta do Instagram
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateProject} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="url" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    URL do Instagram
                                </Label>
                                <Input
                                    id="url"
                                    placeholder="https://instagram.com/marca"
                                    value={newProjectUrl}
                                    onChange={(e) => setNewProjectUrl(e.target.value)}
                                    disabled={isCreating}
                                    className="h-11"
                                />
                            </div>
                            <Button type="submit" variant="gradient" className="w-full" disabled={isCreating || !newProjectUrl}>
                                {isCreating ? (
                                    <>
                                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Criando...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="h-4 w-4" />
                                        Criar Projeto
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {projects === undefined ? (
                    // Loading state
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                        <span>Carregando projetos...</span>
                    </div>
                ) : projects.length === 0 ? (
                    // Empty state
                    <div className="col-span-full md:col-span-2 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 p-12 text-center animate-in fade-in-50 bg-gradient-to-br from-muted/30 to-transparent">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-purple shadow-lg shadow-primary/20">
                            <Instagram className="h-8 w-8 text-white" />
                        </div>
                        <h3 className="mt-6 text-xl font-bold">Nenhum projeto ainda</h3>
                        <p className="mb-4 mt-2 text-sm text-muted-foreground max-w-sm">
                            Comece adicionando uma URL do Instagram ao lado para iniciar sua primeira análise com IA.
                        </p>
                        <div className="flex items-center gap-2 text-xs text-primary">
                            <ArrowRight className="h-3 w-3 animate-pulse" />
                            <span>Adicione seu primeiro projeto</span>
                        </div>
                    </div>
                ) : (
                    // Project list
                    projects.map((project) => (
                        <Card key={project._id} className="group relative overflow-hidden">
                            {/* Profile Picture & Header */}
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    {/* Profile Picture */}
                                    <div className="relative shrink-0">
                                        <div className="h-12 w-12 rounded-xl overflow-hidden ring-2 ring-border/50 bg-gradient-to-br from-primary/20 to-pink-500/20">
                                            {project.profilePictureStorageUrl ? (
                                                <Image
                                                    src={project.profilePictureStorageUrl}
                                                    alt={project.name}
                                                    width={48}
                                                    height={48}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center">
                                                    <Instagram className="h-5 w-5 text-primary/60" />
                                                </div>
                                            )}
                                        </div>
                                        {/* Online indicator */}
                                        <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-background border-2 border-background flex items-center justify-center">
                                            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <CardTitle className="truncate">
                                            @{project.instagramHandle || project.name}
                                        </CardTitle>
                                        {project.bio ? (
                                            <CardDescription className="line-clamp-1">
                                                {project.bio}
                                            </CardDescription>
                                        ) : (
                                            <CardDescription className="truncate">
                                                {project.instagramUrl}
                                            </CardDescription>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                {/* Stats */}
                                {(project.followersCount !== undefined || project.postsCount !== undefined) && (
                                    <div className="flex items-center gap-4">
                                        {project.followersCount !== undefined && (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Users className="h-3 w-3" />
                                                <span className="font-medium text-foreground">
                                                    {project.followersCount >= 1000
                                                        ? `${(project.followersCount / 1000).toFixed(1)}k`
                                                        : project.followersCount}
                                                </span>
                                                <span>seguidores</span>
                                            </div>
                                        )}
                                        {project.postsCount !== undefined && (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Grid3X3 className="h-3 w-3" />
                                                <span className="font-medium text-foreground">{project.postsCount}</span>
                                                <span>posts</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                                    <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                                        {new Date(project.createdAt).toLocaleDateString("pt-BR", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric"
                                        })}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            asChild
                                        >
                                            <Link href={`/dashboard/projects/${project._id}`}>
                                                Abrir
                                                <ArrowRight className="ml-1 h-3.5 w-3.5" />
                                            </Link>
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    title="Excluir projeto"
                                                    disabled={deletingProjectId === project._id}
                                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    {deletingProjectId === project._id ? (
                                                        <div className="h-3 w-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                                                    ) : (
                                                        <Trash className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="border-border/50 bg-background/95 backdrop-blur-xl">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Excluir projeto</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Deseja realmente excluir o projeto &quot;{project.name}&quot;? Essa ação não pode ser desfeita.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleDeleteProject(project._id)}
                                                        className="bg-destructive text-white hover:bg-destructive/90"
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
                                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
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

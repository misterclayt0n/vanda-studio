"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Plus, Instagram, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
    const projects = useQuery(api.projects.list);
    const createProject = useMutation(api.projects.create);
    const fetchInstagramProfile = useAction(api.instagram.fetchProfile);

    const [newProjectUrl, setNewProjectUrl] = useState("");
    const [isCreating, setIsCreating] = useState(false);

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

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground">
                        Gerencie suas marcas e análises.
                    </p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="col-span-full md:col-span-1">
                    <CardHeader>
                        <CardTitle>Novo Projeto</CardTitle>
                        <CardDescription>
                            Adicione uma nova conta do Instagram para analisar.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateProject} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="url">URL do Instagram</Label>
                                <Input
                                    id="url"
                                    placeholder="https://instagram.com/marca"
                                    value={newProjectUrl}
                                    onChange={(e) => setNewProjectUrl(e.target.value)}
                                    disabled={isCreating}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isCreating || !newProjectUrl}>
                                {isCreating ? "Criando..." : (
                                    <>
                                        <Plus className="mr-2 h-4 w-4" /> Criar Projeto
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {projects === undefined ? (
                    // Loading state
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        Carregando projetos...
                    </div>
                ) : projects.length === 0 ? (
                    // Empty state
                    <div className="col-span-full md:col-span-2 flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <Instagram className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold">Nenhum projeto ainda</h3>
                        <p className="mb-4 mt-2 text-sm text-muted-foreground max-w-sm">
                            Comece adicionando uma URL do Instagram acima para iniciar sua primeira análise.
                        </p>
                    </div>
                ) : (
                    // Project list
                    projects.map((project) => (
                        <Card key={project._id} className="group relative overflow-hidden transition-all hover:border-primary/50">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span className="truncate">{project.name}</span>
                                    <Instagram className="h-4 w-4 text-muted-foreground" />
                                </CardTitle>
                                <CardDescription className="truncate">
                                    {project.instagramUrl}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <span>Criado em {new Date(project.createdAt).toLocaleDateString()}</span>
                                    <Button variant="ghost" size="sm" className="group-hover:translate-x-1 transition-transform" asChild>
                                        <Link href={`/dashboard/projects/${project._id}`}>
                                            Abrir <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}

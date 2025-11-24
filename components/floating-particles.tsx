"use client";

import { useEffect, useState } from "react";

interface Particle {
    id: number;
    left: number;
    delay: number;
    duration: number;
    size: number;
}

export function FloatingParticles() {
    const [particles, setParticles] = useState<Particle[]>([]);

    useEffect(() => {
        const particleCount = 20;
        const newParticles: Particle[] = [];

        for (let i = 0; i < particleCount; i++) {
            newParticles.push({
                id: i,
                left: Math.random() * 100,
                delay: Math.random() * 20,
                duration: 15 + Math.random() * 20,
                size: 2 + Math.random() * 4,
            });
        }

        setParticles(newParticles);
    }, []);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
            {particles.map((particle) => (
                <div
                    key={particle.id}
                    className="absolute bottom-0 rounded-full bg-primary/20"
                    style={{
                        left: `${particle.left}%`,
                        width: `${particle.size}px`,
                        height: `${particle.size}px`,
                        animation: `float ${particle.duration}s linear infinite`,
                        animationDelay: `-${particle.delay}s`,
                    }}
                />
            ))}
        </div>
    );
}

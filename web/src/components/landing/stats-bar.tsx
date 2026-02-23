'use client';

import React from 'react';
import { motion } from 'framer-motion';

const stats = [
    { value: '100%', label: 'Online', sublabel: 'Nada para instalar' },
    { value: 'iOS & Android', label: 'App Nativo', sublabel: 'Para seus alunos' },
    { value: '< 3min', label: 'Para montar', sublabel: 'Um treino completo' },
    { value: '24/7', label: 'Sincronizado', sublabel: 'Tempo real' },
];

export const StatsBar = () => {
    return (
        <section className="py-16 bg-white border-y border-black/[0.04]">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
                    {stats.map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1, duration: 0.5 }}
                            className="text-center"
                        >
                            <div className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                                {stat.value}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-violet-600">
                                {stat.label}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-400 font-medium">
                                {stat.sublabel}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

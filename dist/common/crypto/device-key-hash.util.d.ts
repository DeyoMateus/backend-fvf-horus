export declare function hashChaveDispositivo(chavePlana: string): string;
export declare function conferirChaveDispositivo(chavePlana: string, armazenado: string): {
    ok: boolean;
    precisaMigrar: boolean;
};

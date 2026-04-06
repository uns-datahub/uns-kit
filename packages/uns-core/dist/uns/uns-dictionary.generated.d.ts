export declare const GeneratedObjectTypes: {
    /**
     * Maziva, olja, čistila, ki se porabijo in niso del izdelka.
     */
    readonly "consumable-resource": "consumable-resource";
    /**
     * Merilno mesto za aktivno/jalovo energijo in moč.
     */
    readonly "energy-meter": "energy-meter";
    /**
     * Energija (elektrika, para, plin).
     */
    readonly "energy-resource": "energy-resource";
    /**
     * Fizična oprema (stroji, peči, senzorji). Uporablja se za spremljanje stanja, meritev in dogodkov.
     */
    readonly equipment: "equipment";
    /**
     * Tekočine in plini, ki niso energenti.
     */
    readonly "fluid-resource": "fluid-resource";
    /**
     * Materialne enote (loti, serije, surovine, polizdelki). Za sledljivost, količine in premike.
     */
    readonly material: "material";
    /**
     * Osebje (operaterji, nadzorniki, tehnologi). Za prisotnost, naloge in status.
     */
    readonly personnel: "personnel";
    /**
     * Posamezen korak v procesu (npr. valjanje, hlajenje, analiza). Za faze ali aktivnosti procesa.
     */
    readonly "process-segment": "process-segment";
    /**
     * Definicija izdelka, recepture, tehnični opisi. Za metapodatke izdelka in revizije.
     */
    readonly "product-definition": "product-definition";
    /**
     * Kazalniki kakovosti izdelka (odstopanja, ocene, rezultati meritev).
     */
    readonly "product-quality": "product-quality";
    /**
     * Status kateregakoli vira (material, osebje, oprema). Za razpoložljivost, okvare, izrabo.
     */
    readonly "resource-status": "resource-status";
    /**
     * Utility viri (voda, zrak, dušik, stisnjeni plini).
     */
    readonly "utility-resource": "utility-resource";
    /**
     * Definicija nalog ali delovnih tokov. Za planirane operacije in navodila.
     */
    readonly "work-definition": "work-definition";
};
export declare const GeneratedObjectTypeDescriptions: Record<keyof typeof GeneratedObjectTypes, string>;
export type GeneratedObjectTypeName = keyof typeof GeneratedObjectTypes;
export declare function getGeneratedObjectTypeDescription(name: string): string | undefined;
export declare const GeneratedAttributes: {
    /**
     * Oddana delovna energija (izvoz).
     */
    readonly "active-energy-delivered": "active-energy-delivered";
    /**
     * Prejeta delovna energija (uvoz).
     */
    readonly "active-energy-received": "active-energy-received";
    /**
     * Alarmni signal.
     */
    readonly alarm: "alarm";
    /**
     * Dodeljeno osebi ali ekipi.
     */
    readonly "assigned-to": "assigned-to";
    /**
     * Nivo pooblastil.
     */
    readonly "authorization-level": "authorization-level";
    /**
     * Razpoložljivost vira.
     */
    readonly availability: "availability";
    /**
     * Številka serije (batch).
     */
    readonly "batch-number": "batch-number";
    /**
     * Prevodnost.
     */
    readonly conductivity: "conductivity";
    /**
     * Poraba.
     */
    readonly consumption: "consumption";
    /**
     * Hitrost porabe.
     */
    readonly "consumption-rate": "consumption-rate";
    /**
     * Strošek.
     */
    readonly cost: "cost";
    /**
     * Tok.
     */
    readonly current: "current";
    /**
     * Odstopanje od specifikacije.
     */
    readonly deviation: "deviation";
    /**
     * Zastoj/izpad.
     */
    readonly downtime: "downtime";
    /**
     * Trajanje faze ali naloge.
     */
    readonly duration: "duration";
    /**
     * Čas zaključka.
     */
    readonly "end-time": "end-time";
    /**
     * Energija.
     */
    readonly energy: "energy";
    /**
     * Poraba energije.
     */
    readonly "energy-consumption": "energy-consumption";
    /**
     * Koda napake.
     */
    readonly "fault-code": "fault-code";
    /**
     * Pretok.
     */
    readonly flow: "flow";
    /**
     * Frekvenca.
     */
    readonly frequency: "frequency";
    /**
     * Trdota materiala.
     */
    readonly hardness: "hardness";
    /**
     * Rezultat pregleda.
     */
    readonly "inspection-result": "inspection-result";
    /**
     * Povezava do navodil.
     */
    readonly "instruction-url": "instruction-url";
    /**
     * Zadnje polnjenje.
     */
    readonly "last-refill": "last-refill";
    /**
     * Nivo zaloge ali rezervoarja.
     */
    readonly level: "level";
    /**
     * Lokacija materiala ali opreme.
     */
    readonly location: "location";
    /**
     * Identifikator lota.
     */
    readonly "lot-id": "lot-id";
    /**
     * Stanje vzdrževanja.
     */
    readonly "maintenance-status": "maintenance-status";
    /**
     * Sestava materiala.
     */
    readonly "material-composition": "material-composition";
    /**
     * Tip materiala.
     */
    readonly "material-type": "material-type";
    /**
     * Število obratovalnih ur.
     */
    readonly "operating-hours": "operating-hours";
    /**
     * Identifikator operaterja.
     */
    readonly "operator-id": "operator-id";
    /**
     * Izhodna količina.
     */
    readonly "output-quantity": "output-quantity";
    /**
     * Uspešno/neuspešno (pass/fail).
     */
    readonly "pass-fail": "pass-fail";
    /**
     * pH vrednost.
     */
    readonly ph: "ph";
    /**
     * Planirani zaključek.
     */
    readonly "planned-end": "planned-end";
    /**
     * Planirani začetek.
     */
    readonly "planned-start": "planned-start";
    /**
     * Moč.
     */
    readonly power: "power";
    /**
     * Prisotnost osebja.
     */
    readonly presence: "presence";
    /**
     * Tlak.
     */
    readonly pressure: "pressure";
    /**
     * Koda izdelka.
     */
    readonly "product-code": "product-code";
    /**
     * Količina materiala.
     */
    readonly quantity: "quantity";
    /**
     * Oddana jalova energija (izvoz).
     */
    readonly "reactive-energy-delivered": "reactive-energy-delivered";
    /**
     * Prejeta jalova energija (uvoz).
     */
    readonly "reactive-energy-received": "reactive-energy-received";
    /**
     * Potrebno dolivanje/dopolnitev.
     */
    readonly "refill-required": "refill-required";
    /**
     * Revizija izdelka.
     */
    readonly revision: "revision";
    /**
     * Vloga osebja.
     */
    readonly role: "role";
    /**
     * Tehnične specifikacije.
     */
    readonly specification: "specification";
    /**
     * Hitrost delovanja.
     */
    readonly speed: "speed";
    /**
     * Čas začetka.
     */
    readonly "start-time": "start-time";
    /**
     * Trenutno stanje vira ali opreme.
     */
    readonly status: "status";
    /**
     * Površinska napaka.
     */
    readonly "surface-defect": "surface-defect";
    /**
     * Ciljni parametri izdelka ali procesa.
     */
    readonly "target-parameters": "target-parameters";
    /**
     * Identifikator naloge.
     */
    readonly "task-id": "task-id";
    /**
     * Seznam nalog.
     */
    readonly "task-list": "task-list";
    /**
     * Temperatura vira/opreme.
     */
    readonly temperature: "temperature";
    /**
     * Natezna trdnost.
     */
    readonly "tensile-strength": "tensile-strength";
    /**
     * Skupni pretok.
     */
    readonly "total-flow": "total-flow";
    /**
     * Izraba vira.
     */
    readonly utilization: "utilization";
    /**
     * Zgodovina verzij.
     */
    readonly "version-history": "version-history";
    /**
     * Merjena vibracija.
     */
    readonly vibration: "vibration";
    /**
     * Napetost.
     */
    readonly voltage: "voltage";
    /**
     * Identifikator delovnega naloga.
     */
    readonly "work-order-id": "work-order-id";
};
export declare const GeneratedAttributeDescriptions: Record<keyof typeof GeneratedAttributes, string>;
export declare const GeneratedAttributesByType: {
    readonly "consumable-resource": {
        /**
         * Nivo zaloge ali rezervoarja.
         */
        readonly level: "level";
        /**
         * Hitrost porabe.
         */
        readonly "consumption-rate": "consumption-rate";
        /**
         * Potrebno dolivanje/dopolnitev.
         */
        readonly "refill-required": "refill-required";
        /**
         * Zadnje polnjenje.
         */
        readonly "last-refill": "last-refill";
        /**
         * Trenutno stanje vira ali opreme.
         */
        readonly status: "status";
    };
    readonly "energy-meter": {
        /**
         * Moč.
         */
        readonly power: "power";
        /**
         * Oddana delovna energija (izvoz).
         */
        readonly "active-energy-delivered": "active-energy-delivered";
        /**
         * Prejeta delovna energija (uvoz).
         */
        readonly "active-energy-received": "active-energy-received";
        /**
         * Oddana jalova energija (izvoz).
         */
        readonly "reactive-energy-delivered": "reactive-energy-delivered";
        /**
         * Prejeta jalova energija (uvoz).
         */
        readonly "reactive-energy-received": "reactive-energy-received";
        /**
         * Napetost.
         */
        readonly voltage: "voltage";
        /**
         * Tok.
         */
        readonly current: "current";
        /**
         * Frekvenca.
         */
        readonly frequency: "frequency";
    };
    readonly "energy-resource": {
        /**
         * Moč.
         */
        readonly power: "power";
        /**
         * Energija.
         */
        readonly energy: "energy";
        /**
         * Oddana delovna energija (izvoz).
         */
        readonly "active-energy-delivered": "active-energy-delivered";
        /**
         * Prejeta delovna energija (uvoz).
         */
        readonly "active-energy-received": "active-energy-received";
        /**
         * Oddana jalova energija (izvoz).
         */
        readonly "reactive-energy-delivered": "reactive-energy-delivered";
        /**
         * Prejeta jalova energija (uvoz).
         */
        readonly "reactive-energy-received": "reactive-energy-received";
        /**
         * Napetost.
         */
        readonly voltage: "voltage";
        /**
         * Tok.
         */
        readonly current: "current";
        /**
         * Frekvenca.
         */
        readonly frequency: "frequency";
        /**
         * Strošek.
         */
        readonly cost: "cost";
    };
    readonly equipment: {
        /**
         * Trenutno stanje vira ali opreme.
         */
        readonly status: "status";
        /**
         * Temperatura vira/opreme.
         */
        readonly temperature: "temperature";
        /**
         * Merjena vibracija.
         */
        readonly vibration: "vibration";
        /**
         * Število obratovalnih ur.
         */
        readonly "operating-hours": "operating-hours";
        /**
         * Koda napake.
         */
        readonly "fault-code": "fault-code";
        /**
         * Hitrost delovanja.
         */
        readonly speed: "speed";
        /**
         * Poraba energije.
         */
        readonly "energy-consumption": "energy-consumption";
    };
    readonly "fluid-resource": {
        /**
         * Pretok.
         */
        readonly flow: "flow";
        /**
         * Tlak.
         */
        readonly pressure: "pressure";
        /**
         * Temperatura vira/opreme.
         */
        readonly temperature: "temperature";
        /**
         * Skupni pretok.
         */
        readonly "total-flow": "total-flow";
        /**
         * Prevodnost.
         */
        readonly conductivity: "conductivity";
        /**
         * pH vrednost.
         */
        readonly ph: "ph";
    };
    readonly material: {
        /**
         * Identifikator lota.
         */
        readonly "lot-id": "lot-id";
        /**
         * Številka serije (batch).
         */
        readonly "batch-number": "batch-number";
        /**
         * Tip materiala.
         */
        readonly "material-type": "material-type";
        /**
         * Količina materiala.
         */
        readonly quantity: "quantity";
        /**
         * Lokacija materiala ali opreme.
         */
        readonly location: "location";
        /**
         * Trenutno stanje vira ali opreme.
         */
        readonly status: "status";
    };
    readonly personnel: {
        /**
         * Prisotnost osebja.
         */
        readonly presence: "presence";
        /**
         * Identifikator naloge.
         */
        readonly "task-id": "task-id";
        /**
         * Vloga osebja.
         */
        readonly role: "role";
        /**
         * Trenutno stanje vira ali opreme.
         */
        readonly status: "status";
    };
    readonly "process-segment": {
        /**
         * Čas začetka.
         */
        readonly "start-time": "start-time";
        /**
         * Čas zaključka.
         */
        readonly "end-time": "end-time";
        /**
         * Trajanje faze ali naloge.
         */
        readonly duration: "duration";
        /**
         * Trenutno stanje vira ali opreme.
         */
        readonly status: "status";
        /**
         * Izhodna količina.
         */
        readonly "output-quantity": "output-quantity";
    };
    readonly "product-definition": {
        /**
         * Koda izdelka.
         */
        readonly "product-code": "product-code";
        /**
         * Revizija izdelka.
         */
        readonly revision: "revision";
        /**
         * Tehnične specifikacije.
         */
        readonly specification: "specification";
        /**
         * Ciljni parametri izdelka ali procesa.
         */
        readonly "target-parameters": "target-parameters";
        /**
         * Sestava materiala.
         */
        readonly "material-composition": "material-composition";
        /**
         * Zgodovina verzij.
         */
        readonly "version-history": "version-history";
    };
    readonly "product-quality": {
        /**
         * Rezultat pregleda.
         */
        readonly "inspection-result": "inspection-result";
        /**
         * Odstopanje od specifikacije.
         */
        readonly deviation: "deviation";
        /**
         * Uspešno/neuspešno (pass/fail).
         */
        readonly "pass-fail": "pass-fail";
        /**
         * Površinska napaka.
         */
        readonly "surface-defect": "surface-defect";
        /**
         * Trdota materiala.
         */
        readonly hardness: "hardness";
        /**
         * Natezna trdnost.
         */
        readonly "tensile-strength": "tensile-strength";
    };
    readonly "resource-status": {
        /**
         * Razpoložljivost vira.
         */
        readonly availability: "availability";
        /**
         * Izraba vira.
         */
        readonly utilization: "utilization";
        /**
         * Zastoj/izpad.
         */
        readonly downtime: "downtime";
        /**
         * Trenutno stanje vira ali opreme.
         */
        readonly status: "status";
        /**
         * Stanje vzdrževanja.
         */
        readonly "maintenance-status": "maintenance-status";
    };
    readonly "utility-resource": {
        /**
         * Tlak.
         */
        readonly pressure: "pressure";
        /**
         * Pretok.
         */
        readonly flow: "flow";
        /**
         * Poraba.
         */
        readonly consumption: "consumption";
        /**
         * Trenutno stanje vira ali opreme.
         */
        readonly status: "status";
        /**
         * Alarmni signal.
         */
        readonly alarm: "alarm";
    };
    readonly "work-definition": {
        /**
         * Identifikator delovnega naloga.
         */
        readonly "work-order-id": "work-order-id";
        /**
         * Seznam nalog.
         */
        readonly "task-list": "task-list";
        /**
         * Planirani začetek.
         */
        readonly "planned-start": "planned-start";
        /**
         * Planirani zaključek.
         */
        readonly "planned-end": "planned-end";
        /**
         * Dodeljeno osebi ali ekipi.
         */
        readonly "assigned-to": "assigned-to";
        /**
         * Povezava do navodil.
         */
        readonly "instruction-url": "instruction-url";
    };
};
export type GeneratedAttributeName = keyof typeof GeneratedAttributes;
export type GeneratedAttributesFor<T extends keyof typeof GeneratedAttributesByType> = keyof typeof GeneratedAttributesByType[T];
export declare function getGeneratedAttributeDescription(name: string): string | undefined;
//# sourceMappingURL=uns-dictionary.generated.d.ts.map
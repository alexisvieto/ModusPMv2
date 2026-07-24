import { describe, it, expect } from "vitest";

import { stripIloSecrets } from "@/lib/inventory";

describe("stripIloSecrets", () => {
  it("anula password y licencia iLO, conserva el resto de los campos", () => {
    const items = [
      {
        id: "1",
        description: "Servidor",
        serial_number: "SN-1",
        ilo_password: "secreto",
        ilo_license: "LIC-XYZ",
      },
      {
        id: "2",
        description: "Switch",
        serial_number: "SN-2",
        ilo_password: null,
        ilo_license: null,
      },
    ];
    const safe = stripIloSecrets(items);
    expect(safe.every((i) => i.ilo_password === null && i.ilo_license === null)).toBe(true);
    expect(safe[0].description).toBe("Servidor");
    expect(safe[0].serial_number).toBe("SN-1");
  });

  it("no muta el arreglo original (el secreto no se filtra por referencia)", () => {
    const items = [{ id: "1", ilo_password: "secreto", ilo_license: "LIC" }];
    stripIloSecrets(items);
    expect(items[0].ilo_password).toBe("secreto");
    expect(items[0].ilo_license).toBe("LIC");
  });

  it("maneja una lista vacía", () => {
    expect(stripIloSecrets([])).toEqual([]);
  });
});

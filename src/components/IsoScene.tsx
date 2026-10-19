import "./iso.css";

function Cube({ className }: { className: string }) {
  return (
    <div className={`iso-cube ${className}`}>
      <i className="t" />
      <i className="y" />
      <i className="x" />
    </div>
  );
}

/** Decorative isometric scene (CSS 3D). Sized by the font-size of its parent. */
export function IsoScene() {
  const plates = [
    { i: 0, z: "1.8em", a: 0.22 },
    { i: 1, z: "4.2em", a: 0.3 },
    { i: 2, z: "6.6em", a: 0.38 },
    { i: 3, z: "9em", a: 0.48 },
  ];
  return (
    <div className="iso-wrap" aria-hidden="true">
      <div className="iso">
        <div className="iso-slab" />
        <div className="iso-rail x" />
        <div className="iso-rail y" />
        <div className="iso-pad" style={{ left: "-0.2em", top: "calc(50% - 1.5em)" }} />
        <div className="iso-pad" style={{ right: "-0.2em", top: "calc(50% - 1.5em)" }} />
        <div className="iso-pad" style={{ top: "-0.2em", left: "calc(50% - 1.5em)" }} />
        <div className="iso-pad" style={{ bottom: "-0.2em", left: "calc(50% - 1.5em)" }} />
        <div className="iso-shadow" />
        <div className="iso-core-base" />

        {plates.map((p) => (
          <div
            key={p.i}
            className="iso-plate"
            style={{ "--i": p.i, "--z": p.z, "--a": p.a } as React.CSSProperties}
          />
        ))}
        <div
          className="iso-plate top"
          style={{ "--i": 4, "--z": "11.4em" } as React.CSSProperties}
        >
          <span className="iso-label">360</span>
        </div>

        <Cube className="iso-run a" />
        <Cube className="iso-run b" />
        <Cube className="iso-run c" />
        <Cube className="iso-run d" />
        <Cube className="iso-float f1" />
        <Cube className="iso-float f2" />
        <Cube className="iso-float f3" />
      </div>
    </div>
  );
}

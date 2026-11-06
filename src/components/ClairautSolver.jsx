import React, { useState, useEffect, useRef } from 'react';
import algebrite from 'algebrite';
import * as math from 'mathjs';
import functionPlot from 'function-plot';

export default function ClairautSolver() {
  const [fpInput, setFpInput] = useState("p^2");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const plotRef = useRef(null);

  const cValues = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

  const solveClairaut = (input) => {
    setError(null);
    setResult(null);

    try {
      let rawFp = input.trim();

      if (rawFp.includes('=')) {
        let normalized = rawFp.replace(/y'/g, 'p').split('=')[1].trim();
        const subResult = algebrite.run(`simplify(${normalized} - (x*p))`).toString();
        if (subResult.includes('x')) {
          throw new Error("La expresión ingresada no cumple la forma de Clairaut y = x*p + f(p).");
        }
        rawFp = subResult;
      } else {
        rawFp = rawFp.replace(/y'/g, 'p');
      }

      // 1. f(p)
      const fpExpr = algebrite.run(`simplify(${rawFp})`).toString();

      // 2 & 3. Ecuaciones mostradas
      const edoYprime = `y = x · y' + (${fpExpr.replace(/p/g, "y'")})`;
      const edoP = `y = x · p + (${fpExpr})`;

      // 4. Solución General y = C*x + f(C)
      const fCExpr = fpExpr.replace(/\bp\b/g, 'C');
      const solGeneralStr = `y = C·x + (${fCExpr})`;

      // Pre-calcular rectas para la gráfica (C = -4..4)
      const generalSolutions = cValues.map((c) => {
        const fCVal = algebrite.run(`subst(${c}, p, ${fpExpr})`).toString();
        const evaluatedFC = math.evaluate(fCVal);
        return {
          c,
          plotFn: `${c} * x + (${evaluatedFC})`
        };
      });

      // 5. Derivada f'(p) usando math.js para evitar textos literales de algebrite
      let fpDerivative = "";
      try {
        const node = math.parse(fpExpr);
        const derivativeNode = math.derivative(node, 'p');
        fpDerivative = derivativeNode.toString();
      } catch (e) {
        fpDerivative = algebrite.run(`simplify(d(${fpExpr}, p))`).toString();
      }

      // 6. Condición x + f'(p) = 0
      const condicion = `x + (${fpDerivative}) = 0`;

      // 7, 8 y 9. Despejar p(x) y sustituir en y = x*p + f(p)
      let pDespejado = null;
      let solSingularStr = null;
      let singularPlotFn = null;

      try {
        const despeje = algebrite.run(`solve(${condicion}, p)`).toString();
        if (despeje && !despeje.includes('solve')) {
          pDespejado = despeje;
          const ySubst = algebrite.run(`simplify(x * (${pDespejado}) + subst(${pDespejado}, p, ${fpExpr}))`).toString();
          solSingularStr = `y = ${ySubst}`;
          singularPlotFn = ySubst;
        }
      } catch (e) {
        // Ignorar si falla el despeje simbólico general
      }

      // Respaldo para casos comunes como p^2
      if (!solSingularStr) {
        if (fpExpr === 'p^2' || fpExpr === '(p)^2') {
          pDespejado = '-x / 2';
          solSingularStr = 'y = -x² / 4';
          singularPlotFn = '-(x^2)/4';
        } else {
          solSingularStr = 'Solución en forma paramétrica';
          singularPlotFn = null;
        }
      }

      setResult({
        fpExpr,
        edoYprime,
        edoP,
        solGeneralStr,
        fpDerivative,
        condicion,
        pDespejado,
        solSingularStr,
        generalSolutions,
        singularPlotFn
      });

    } catch (err) {
      setError(err.message || "Error al procesar la función f(p). Verifica la sintaxis.");
    }
  };

  // Renderizado del Gráfico seguro
  useEffect(() => {
    if (!result || !plotRef.current) return;

    try {
      plotRef.current.innerHTML = "";

      const familyData = result.generalSolutions.map((sol) => ({
        fn: sol.plotFn,
        color: '#94a3b8',
        skipTip: true
      }));

      const dataPlot = [...familyData];

      if (result.singularPlotFn) {
        dataPlot.push({
          fn: result.singularPlotFn,
          color: '#2563eb',
          attr: { 'stroke-width': 3 }
        });
      }

      // Asegurar compatibilidad de importación de function-plot
      const renderPlot = functionPlot.default || functionPlot;

      renderPlot({
        target: plotRef.current,
        width: plotRef.current.clientWidth || 500,
        height: 420,
        grid: true,
        xAxis: { domain: [-12, 12], label: 'Eje X' },
        yAxis: { domain: [-12, 12], label: 'Eje Y' },
        data: dataPlot
      });

    } catch (e) {
      console.error("Error graficando:", e);
    }
  }, [result]);

  const handleSubmit = (e) => {
    e.preventDefault();
    solveClairaut(fpInput);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 bg-gray-50 min-h-screen">
      <header className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-gray-900"
        style={{ color: '#111827' }}>
          Solucionador de Ecuaciones Diferenciales de Clairaut
        </h1>
        <p className="text-gray-700">
          Ingresa la función f ( p ) o la ecuación completa
        </p>
      </header>

      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 flex items-center gap-2">
            <span className="font-semibold text-gray-700 font-mono text-lg">f(p) =</span>
            <input
              type="text"
              value={fpInput}
              onChange={(e) => setFpInput(e.target.value)}
              placeholder="Ej: p^2  o  y = x*p + p^2"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-lg text-gray-900 bg-white"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors shadow"
          >
            Resolver y Graficar
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
            <p className="font-semibold">Error de Entrada:</p>
            <p>{error}</p>
          </div>
        )}
      </div>

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 space-y-5 text-gray-800">
            <h2 className="text-xl font-black text-gray-900 border-b border-gray-300 pb-3 w-full text-center tracking-wide"
            style={{ color: '#111827' }}>
              Demostración y Paso a Paso
            </h2>

            <section className="space-y-1">
              <h3 className="font-semibold text-blue-700 text-sm">Ecuación Planteada</h3>
              <div className="bg-gray-100 p-2.5 rounded font-mono text-sm text-gray-900 space-y-1">
                <div>Original: <span className="font-bold">{result.edoYprime}</span></div>
                <div>Con p = y': <span className="font-bold">{result.edoP}</span></div>
              </div>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-blue-700 text-sm">Solución General</h3>
              <div className="bg-blue-50 border border-blue-200 p-2.5 rounded font-mono text-blue-900 font-bold text-sm">
                {result.solGeneralStr}
              </div>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-blue-700 text-sm">Derivada y Condición Singular</h3>
              <div className="bg-gray-100 p-2.5 rounded font-mono text-sm text-gray-900 space-y-1">
                <div>f'(p) = <span className="font-bold">{result.fpDerivative}</span></div>
                <div>Condición: <span className="font-bold">{result.condicion}</span></div>
              </div>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-blue-700 text-sm">Solución Singular (Envolvente)</h3>
              <div className="bg-amber-50 border border-amber-200 p-3 rounded font-mono text-sm text-amber-900 space-y-2">
                <div>
                  <span className="text-xs text-gray-600 block">Despeje de p(x):</span>
                  <span className="font-bold">{result.pDespejado ? `p = ${result.pDespejado}` : 'No despejable directamente'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-600 block">Reemplazo y Solución Singular Final:</span>
                  <span className="text-base font-bold text-gray-900 bg-white px-2 py-1 border border-amber-300 rounded inline-block mt-1">
                    {result.solSingularStr}
                  </span>
                </div>
              </div>
            </section>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 flex flex-col items-center">
            <h2 className="text-xl font-black text-gray-900 border-b border-gray-300 pb-3 w-full text-center tracking-wide"
            style={{ color: '#111827' }}>
              Plano Cartesiano
            </h2>

            <div className="flex gap-4 my-3 text-sm flex-wrap justify-center">
              <span className="flex items-center gap-1.5 font-medium text-gray-700">
                <span className="w-3 h-3 bg-blue-600 inline-block rounded-full"></span> 
                Rectas Solución General (C ∈ [-4, 4])
              </span>
              <span className="flex items-center gap-1.5 font-medium text-gray-700">
                <span className="w-3 h-3 bg-red-600 inline-block rounded-full"></span> 
                Solución Singular (Envolvente)
              </span>
            </div>

            <div ref={plotRef} className="w-full flex justify-center overflow-hidden border border-red-200 rounded-lg bg-white"></div>
          </div>
        </div>
      )}
    </div>
  );
}
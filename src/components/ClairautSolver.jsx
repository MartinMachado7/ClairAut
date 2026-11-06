import React, { useState, useEffect, useRef } from 'react';
import algebrite from 'algebrite';
import * as math from 'mathjs';
import functionPlot from 'function-plot';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

export default function ClairautSolver() {
  const [fpInput, setFpInput] = useState("1/p");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const plotRef = useRef(null);

  const cValues = [-4, -3, -2, -1, 0.1, 1, 2, 3, 4];

  const formatToLatex = (str) => {
    if (!str) return '';
    let latex = str
      .replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')
      .replace(/p\^\(1\/2\)/g, '\\sqrt{p}')
      .replace(/y'\^\(1\/2\)/g, '\\sqrt{y\'}')
      .replace(/C\^\(1\/2\)/g, '\\sqrt{C}')
      .replace(/p\^2/g, 'p^2')
      .replace(/x\^2/g, 'x^2')
      .replace(/C\^2/g, 'C^2')
      .replace(/\*\*/g, '^')
      .replace(/\*/g, '\\cdot ');

    // Formateo explícito para evitar fracciones superpuestas
    latex = latex.replace(/1\s*\/\s*\(\s*2\s*\\cdot\s*\\sqrt\{p\}\s*\)/g, '\\frac{1}{2\\sqrt{p}}');
    latex = latex.replace(/1\s*\/\s*\(\s*4\s*\\cdot\s*x\^2\s*\)/g, '\\frac{1}{4x^2}');
    latex = latex.replace(/-1\s*\/\s*\(\s*4\s*\\cdot\s*x\s*\)/g, '-\\frac{1}{4x}');
    
    latex = latex.replace(/1\s*\/\s*p\^2/g, '\\frac{1}{p^2}');
    latex = latex.replace(/1\s*\/\s*x\^2/g, '\\frac{1}{x^2}');
    latex = latex.replace(/1\s*\/\s*p\b/g, '\\frac{1}{p}');
    latex = latex.replace(/1\s*\/\s*x\b/g, '\\frac{1}{x}');

    return latex;
  };

  const solveClairaut = (input) => {
    setError(null);
    setResult(null);

    try {
      let rawFp = input.trim();

      rawFp = rawFp.replace(/√\s*([a-zA-Z0-9]+)/g, 'sqrt($1)');
      rawFp = rawFp.replace(/√\s*\(([^)]+)\)/g, 'sqrt($1)');

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

      const fpExpr = algebrite.run(`simplify(${rawFp})`).toString();
      const formattedFp = formatToLatex(fpExpr);

      const formattedYprime = formattedFp.replace(/p\^2/g, "{y'}^2").replace(/p/g, "y'");
      const edoYprime = `y = x \\cdot y' + \\left(${formattedYprime}\\right)`;
      const edoP = `y = x \\cdot p + \\left(${formattedFp}\\right)`;
      
      const fCExpr = fpExpr.replace(/\bp\b/g, 'C');
      const solGeneralStr = `y = C \\cdot x + \\left(${formatToLatex(fCExpr)}\\right)`;

      const generalSolutions = [];
      for (let c of cValues) {
        try {
          const fCVal = algebrite.run(`subst(${c}, p, ${fpExpr})`).toString();
          const evaluatedFC = math.evaluate(fCVal);
          if (isFinite(evaluatedFC)) {
            generalSolutions.push({
              c,
              plotFn: `${c} * x + (${evaluatedFC})`
            });
          }
        } catch (e) {}
      }

      let fpDerivative = "";
      try {
        const cleanedFp = fpExpr.replace(/\s+/g, '');
        if (cleanedFp === '1/p' || cleanedFp === 'p^(-1)') {
          fpDerivative = '-\\frac{1}{p^2}';
        } else if (cleanedFp === 'sqrt(p)' || cleanedFp === 'p^(1/2)') {
          fpDerivative = '\\frac{1}{2\\sqrt{p}}';
        } else {
          const node = math.parse(fpExpr);
          const derivativeNode = math.derivative(node, 'p');
          fpDerivative = derivativeNode.toString();
        }
      } catch (e) {
        fpDerivative = algebrite.run(`simplify(d(${fpExpr}, p))`).toString();
      }

      let pDespejado = null;
      let solSingularStr = null;
      let singularPlotFn = null;
      let singularSteps = [];

      const cleanedFp = fpExpr.replace(/\s+/g, '');
      if (cleanedFp === 'p^2' || cleanedFp === '(p)^2') {
        pDespejado = '-\\frac{x}{2}';
        solSingularStr = 'y = -\\frac{x^2}{4}';
        singularPlotFn = '-(x^2)/4';
        singularSteps = [
          `y = x \\left(-\\frac{x}{2}\\right) + \\left(-\\frac{x}{2}\\right)^2`,
          `y = -\\frac{x^2}{2} + \\frac{x^2}{4}`
        ];
      } else if (cleanedFp === '1/p' || cleanedFp === 'p^(-1)') {
        pDespejado = '\\frac{1}{\\sqrt{x}}';
        solSingularStr = 'y = 2\\sqrt{x}';
        singularPlotFn = '2 * sqrt(x)';
        singularSteps = [
          `y = x \\left(\\frac{1}{\\sqrt{x}}\\right) + \\frac{1}{\\frac{1}{\\sqrt{x}}}`,
          `y = \\sqrt{x} + \\sqrt{x}`
        ];
      } else if (cleanedFp === 'sqrt(p)' || cleanedFp === 'p^(1/2)') {
        pDespejado = '\\frac{1}{4x^2}';
        solSingularStr = 'y = -\\frac{1}{4x}';
        singularPlotFn = '-1 / (4 * x)';
        singularSteps = [
          `y = x \\left(\\frac{1}{4x^2}\\right) + \\sqrt{\\frac{1}{4x^2}}`,
          `y = \\frac{1}{4x} + \\frac{1}{2x}`
        ];
      } else {
        try {
          const despeje = algebrite.run(`solve(x + (${fpDerivative}) = 0, p)`).toString();
          if (despeje && !despeje.includes('solve')) {
            pDespejado = despeje;
            const ySubst = algebrite.run(`simplify(x * (${pDespejado}) + subst(${pDespejado}, p, ${fpExpr}))`).toString();
            solSingularStr = `y = ${ySubst}`;
            singularPlotFn = ySubst;
            singularSteps = [
              `y = x \\left(${formatToLatex(pDespejado)}\\right) + f\\left(${formatToLatex(pDespejado)}\\right)`
            ];
          }
        } catch (e) {}
      }

      setResult({
        fpExpr: formattedFp,
        edoYprime,
        edoP,
        solGeneralStr,
        fpDerivative: formatToLatex(fpDerivative),
        pDespejado: pDespejado ? formatToLatex(pDespejado) : null,
        solSingularStr: formatToLatex(solSingularStr),
        singularSteps,
        generalSolutions,
        singularPlotFn
      });

    } catch (err) {
      setError(err.message || "Error al procesar la función f(p). Verifica la sintaxis.");
    }
  };

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
    <div className="max-w-6xl mx-auto p-6 space-y-8 bg-gray-50 min-h-screen font-sans">
      <header className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-gray-900" style={{ color: '#111827' }}>
          Solucionador de Ecuaciones Diferenciales de Clairaut
        </h1>
      </header>

      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 flex items-center gap-2">
            <span className="font-semibold text-gray-700 font-mono text-lg">f(p) =</span>
            <input
              type="text"
              value={fpInput}
              onChange={(e) => setFpInput(e.target.value)}
              placeholder="Ej: p^2, 1/p, sqrt(p)"
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
            <p>{error}</p>
          </div>
        )}
      </div>

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 space-y-6">
            <h2 className="text-2xl font-black border-b border-gray-300 pb-3 w-full text-center tracking-wide" style={{ color: '#111827' }}>
              Demostración y Paso a Paso
            </h2>

            {/* Ecuación Planteada */}
            <section className="space-y-2">
              <h3 className="font-bold text-blue-600 text-center text-lg">Ecuación Planteada</h3>
              <div className="bg-gray-100 p-5 rounded text-gray-900 space-y-5 text-center text-lg overflow-x-auto">
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <span>Original:</span> <InlineMath math={`\\displaystyle ${result.edoYprime || ''}`} />
                </div>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <span>Con <InlineMath math="p = y'" />:</span> <InlineMath math={`\\displaystyle ${result.edoP || ''}`} />
                </div>
              </div>
            </section>

            {/* Solución General */}
            <section className="space-y-2">
              <h3 className="font-bold text-blue-600 text-center text-lg">Solución General</h3>
              <div className="bg-blue-50 border border-blue-200 p-5 rounded text-blue-900 text-center space-y-5 overflow-x-auto">
                <div><InlineMath math="\displaystyle p = C" /></div>
                <div><InlineMath math="\displaystyle y = C \cdot x + f(C)" /></div>
                <div className="mt-2 text-xl font-bold"><BlockMath math={result.solGeneralStr || ''} /></div>
              </div>
            </section>

            {/* Derivada y Condición Singular */}
            <section className="space-y-2">
              <h3 className="font-bold text-blue-600 text-center text-lg">Derivada y Condición Singular</h3>
              <div className="bg-gray-100 p-5 rounded text-gray-900 space-y-5 text-center text-lg overflow-x-auto">
                <div><InlineMath math={`\\displaystyle f(p) = ${result.fpExpr || ''}`} /></div>
                <div><InlineMath math={`\\displaystyle f'(p) = ${result.fpDerivative || ''}`} /></div>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <span>Condición:</span> <InlineMath math={`\\displaystyle x + \\left(${result.fpDerivative || ''}\\right) = 0`} />
                </div>
              </div>
            </section>

            {/* Solución Singular */}
            <section className="space-y-2">
              <h3 className="font-bold text-blue-600 text-center text-lg">Solución Singular (Envolvente)</h3>
              <div className="bg-amber-50 border border-amber-200 p-6 rounded text-amber-900 space-y-6 text-center overflow-x-auto">
                <div className="text-sm text-gray-600">Despeje de p(x):</div>
                <div className="text-xl font-bold">
                  {result.pDespejado ? <BlockMath math={`p = ${result.pDespejado}`} /> : 'No despejable'}
                </div>
                
                <div className="text-sm text-gray-600 mt-4">Reemplazo:</div>
                <div className="text-lg"><BlockMath math={result.edoP || ''} /></div>
                {result.singularSteps.map((step, index) => (
                  <div key={index} className="text-lg"><BlockMath math={step || ''} /></div>
                ))}
                
                <div className="text-sm text-gray-600 mt-4">Solución Singular Final:</div>
                <div className="bg-white p-4 border border-amber-300 rounded inline-block shadow-sm text-xl font-bold">
                  <InlineMath math={`\\displaystyle ${result.solSingularStr || ''}`} />
                </div>
              </div>
            </section>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 flex flex-col items-center">
            <h2 className="text-xl font-black border-b border-gray-300 pb-3 w-full text-center tracking-wide" style={{ color: '#111827' }}>
              Plano Cartesiano
            </h2>
            <div className="flex gap-4 my-3 text-sm flex-wrap justify-center">
              <span className="flex items-center gap-1.5 font-medium text-gray-700">
                <span className="w-3 h-3 bg-blue-600 inline-block rounded-full"></span> 
                Rectas Solución General
              </span>
              <span className="flex items-center gap-1.5 font-medium text-gray-700">
                <span className="w-3 h-3 bg-gray-600 inline-block rounded-full"></span> 
                Solución Singular (Envolvente)
              </span>
            </div>
            <div ref={plotRef} className="w-full flex justify-center overflow-hidden border border-gray-200 rounded-lg bg-white" style={{ minHeight: '420px' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}
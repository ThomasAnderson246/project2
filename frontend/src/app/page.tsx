'use client';

import { useState, useEffect } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from "chart.js";
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

interface SummaryItem {
  label: string;
  value: string;
}

interface AvgMacro {
  Diet_type: string;
  'Protein(g)':number;
  'Carbs(g)': number;
  'Fat(g)':number;
}

interface TopProteinRecipe {
  Recipe_name: string;
  'Protein(g)': number;
  Cuisine_type: string;
  Diet_type: string;
}

interface DietDistribution {
  diet_type: string;
  count: number;
}

interface Metadata {
  highestProteinDiet: string;
  commonCuisines: Record<string, string>;
}

interface ApiResponse {
  title: string;
  summary: SummaryItem[];
  dataVisualizations: {
    avgMacros: AvgMacro[];
    topProteinRecipes: TopProteinRecipe[];
    dietDistribution: DietDistribution[];
  };
  metadata: Metadata;
  executionTimeMs: number;
}

export default function Dashboard() {
  const [apiUrl, setApiUrl] = useState<string>('');
  const[data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [ error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('apiUrl');
    if (saved) {
      setApiUrl(saved);
    }
  }, []);

  
  useEffect(() => {
    fetchData();
    
  }, [])
  const fetchData = async () => {
    

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(AZURE_FUNCTION_URL);

      if (!response.ok) {
        throw new Error (`HTTP error! Status: ${response.status}`);
      }

      const result: ApiResponse = await response.json();

      if ('error' in result) {
        throw new Error((result as any).error);
      }
      localStorage.setItem('apiUrl', apiUrl);
      setData(result);
    } catch (error) {
      setError(`Failed to fetch data: ${error instanceof Error ? error.message: 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getMacrosChartData = () => {
    if (!data?.dataVisualizations?.avgMacros) return  null;

    const avgMacros = data.dataVisualizations.avgMacros;
    const dietTypes = avgMacros.map(d => d.Diet_type);
    const protein = avgMacros.map(d => d['Protein(g)']);
    const carbs = avgMacros.map(d => d['Carbs(g)']);
    const fat = avgMacros.map(d => d['Fat(g)']);

    return {
      labels: dietTypes,
      datasets: [
        {
          label: 'Protein (g)',
          data: protein,
          backgroundColor: 'rgba(255, 99, 132, 0.7)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 2,
        },
        {
          label: 'Carbs (g)',
          data: carbs,
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2,
        },
        {
          label: 'Fat (g)',
          data: fat,
          backgroundColor: 'rgba(255, 206, 86, 0.7)',
          borderColor: 'rgba(255, 206, 86, 1)',
          borderWidth: 2,
        },
      ],
    };
  };

const getDistributionChartData = () => {
  if (!data?.dataVisualizations?.dietDistribution) return null;

  const distribution = data.dataVisualizations.dietDistribution;
  const labels = distribution.map(d => d.diet_type);
  const counts = distribution.map(d => d.count);

  return {
    labels: labels,
    datasets: [{
      data: counts,
      backgroundColor: [
        'rgba(255, 99, 132, 0.7)',
        'rgba(54, 162, 235, 0.7)',
        'rgba(255, 206, 86, 0.7)',
        'rgba(75, 192, 192, 0.7)',
        'rgba(153, 102, 255, 0.7)',
        'rgba(255, 159, 64, 0.7)',
      ],
      borderWidth: 2,
      borderColor: '#fff',
    }]
  };
};

const getProteinChartData = () => {
  if (!data?.dataVisualizations?.topProteinRecipes) return null;

  const top15 = data.dataVisualizations.topProteinRecipes.slice(0, 15);
  const labels = top15.map(r => r.Recipe_name.substring(0, 30) + '...');
  const protein = top15.map( r => r['Protein(g)']);

  return {
    labels: labels, 
    datasets: [{
      label: 'Protein (g)',
      data: protein,
      backgroundColor: 'rgba(102, 126, 234, 0.7)',
      borderColor: 'rgba(102, 126, 234, 1)',
      borderWidth: 2,
    }],
  };
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false, 
  plugins: {
    legend: {
      position: 'top' as const,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
    },
  },
};

const proteinChartOptions = {
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  plugins:{
    legend: {
      display: false,
    },
  },
  scales: {
    x: {
      beginAtZero: true,
    },
  },
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false, 
  plugins: {
    legend: {
      position: 'right' as const,
    },
  },
};

const macrosChartData = getMacrosChartData();
const distributionChartData = getDistributionChartData();
const proteinChartData = getProteinChartData();
const AZURE_FUNCTION_URL = "https://diet-analysis-func.azurewebsites.net/api/analyze";

return (
  <div className="min-h-screen bg-linear-to-br from-gray-900 via-slate-800 to-gray-900 p-6">
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center text-white mb-8">
        
        

      
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-6 mb-6">
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[300px]">
            <h1 className="text-4xl font-bold mb-2 bg-linear-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Diet & Macro-Nutrient Analysis Dashboard
            </h1>
            <p className="text-lg text-gray-300">
              Cloud-Powered Analytics with Azure Functions
            </p>
          </div>

          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-6 py-2 bg-linear-to-r mt-2 from-blue-600 to-cyan-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {loading ? "Loading..." : "Refresh Data"}
          </button>
        </div>
      </div>

      
      {loading && (
        <div className="text-center text-gray-300 text-xl py-10">
          Loading data from Azure Functions...
        </div>
      )}

      
      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 rounded-xl p-6 mb-6 text-center">
          {error}
        </div>
      )}

      
      {data && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {data.summary.map((item, index) => (
              <div
                key={index}
                className="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-6 hover:shadow-2xl hover:border-blue-500 transition-all"
              >
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {item.label}
                </h3>
                <div className="text-3xl font-bold bg-linear-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Macros Chart */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                Average Macros by Diet Type
              </h2>
              <div className="h-80">
                {macrosChartData && (
                  <Bar data={macrosChartData} options={chartOptions} />
                )}
              </div>
            </div>

            
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                Diet Type Distribution
              </h2>
              <div className="h-80">
                {distributionChartData && (
                  <Doughnut
                    data={distributionChartData}
                    options={doughnutOptions}
                  />
                )}
              </div>
            </div>

            
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-6 lg:col-span-2">
              <h2 className="text-xl font-bold text-white mb-4">
                Top 15 High-Protein Recipes
              </h2>
              <div className="h-96">
                {proteinChartData && (
                  <Bar
                    data={proteinChartData}
                    options={proteinChartOptions}
                  />
                )}
              </div>
            </div>
          </div>

          
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Analysis Metadata
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="font-semibold text-gray-300">
                  Highest Protein Diet:
                </span>
                <span className="text-blue-400 font-semibold">
                  {data.metadata.highestProteinDiet}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="font-semibold text-gray-300">
                  Function Execution Time:
                </span>
                <span className="text-cyan-400 font-semibold">
                  {data.executionTimeMs} ms
                </span>
              </div>
              <div className="py-2">
                <span className="font-semibold text-gray-300 block mb-2">
                  Most Common Cuisines by Diet:
                </span>
                <ul className="ml-4 space-y-1">
                  {Object.entries(data.metadata.commonCuisines).map(
                    ([diet, cuisine]) => (
                      <li key={diet} className="text-gray-400">
                        <strong className="text-gray-300">{diet}:</strong> {cuisine}
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  </div>
);
}
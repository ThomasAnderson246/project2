'use client';

import { useState, useEffect } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from "chart.js";
import { Bar, Doughnut } from 'react-chartjs-2';
// --- Google Auth Imports ---
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

// --- Interfaces ---
interface SummaryItem { label: string; value: string; }
interface AvgMacro { Diet_type: string; 'Protein(g)': number; 'Carbs(g)': number; 'Fat(g)': number; }
interface TopProteinRecipe { Recipe_name: string; 'Protein(g)': number; Cuisine_type: string; Diet_type: string; }
interface DietDistribution { diet_type: string; count: number; }
interface Metadata { highestProteinDiet: string; commonCuisines: Record<string, string>; }

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

interface Recipe {
  Recipe_name: string; Cuisine_type: string; Diet_type: string;
  'Protein(g)': number; 'Carbs(g)': number; 'Fat(g)': number;
}

interface RecipeApiResponse {
  page: number; limit: number; total_items: number; total_pages: number; recipes: Recipe[];
}

interface User {
  email: string;
  name: string;
  picture?: string; // Added picture for Google user
}

export default function Dashboard() {
  // --- Auth State ---
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // --- Dashboard State ---
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --- Recipe Search State ---
  const [recipesData, setRecipesData] = useState<RecipeApiResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [dietFilter, setDietFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Config
  const API_BASE = "https://diet-analysis-func.azurewebsites.net/api";
  const GOOGLE_CLIENT_ID = "323348568372-2u9mf2nbeinrm7b14pc3q7jk92biml7n.apps.googleusercontent.com";

  // Check LocalStorage on Load
  useEffect(() => {
    const savedUser = localStorage.getItem('diet_app_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Fetch Data when User Logs In
  useEffect(() => {
    if (user) {
      fetchDashboardData();
      fetchRecipes();
    }
  }, [user]);

  // Update recipes when filter/page changes
  useEffect(() => {
    if (user) fetchRecipes();
  }, [currentPage, dietFilter]);

  // --- Auth Functions ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    const endpoint = authMode === 'login' ? '/login' : '/register';
    const payload = authMode === 'login' 
      ? { email, password } 
      : { email, password, name };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'Authentication failed');

      if (authMode === 'register') {
        alert("Registration successful! Please login.");
        setAuthMode('login');
      } else {
        // Login Success
        const loggedInUser = { email: result.user.email, name: result.user.name };
        setUser(loggedInUser);
        localStorage.setItem('diet_app_user', JSON.stringify(loggedInUser));
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Auth failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // --- REAL GOOGLE LOGIN HANDLER ---
  const handleGoogleSuccess = (credentialResponse: any) => {
    try {
      // Decode the JWT token to get user info
      const decoded: any = jwtDecode(credentialResponse.credential);
      console.log("Google Login Success:", decoded);

      const googleUser: User = {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture
      };

      setUser(googleUser);
      localStorage.setItem('diet_app_user', JSON.stringify(googleUser));
    } catch (err) {
      console.error("Google Login Failed", err);
      setAuthError("Failed to verify Google login.");
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('diet_app_user');
    setData(null);
    setRecipesData(null);
  };

  // Keep GitHub as Fake Demo
  const handleGitHubDemo = () => {
    setAuthLoading(true);
    setTimeout(() => {
      const demoUser = { email: `demo@github.com`, name: `GitHub User (Demo)` };
      setUser(demoUser);
      localStorage.setItem('diet_app_user', JSON.stringify(demoUser));
      setAuthLoading(false);
    }, 1000);
  };

  // --- Data Fetching Functions ---
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/analyze`);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const result: ApiResponse = await response.json();
      setData(result);
    } catch (error) {
      setError(`Failed to fetch data`);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipes = async () => {
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(), limit: "6", search: searchTerm, diet: dietFilter
      });
      const response = await fetch(`${API_BASE}/recipes?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch recipes");
      const result: RecipeApiResponse = await response.json();
      setRecipesData(result);
    } catch (err) { console.error(err); } finally { setSearchLoading(false); }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchRecipes();
  };

  // --- Chart Helpers ---
  const getMacrosChartData = () => {
    if (!data?.dataVisualizations?.avgMacros) return null;
    const avgMacros = data.dataVisualizations.avgMacros;
    return {
      labels: avgMacros.map(d => d.Diet_type),
      datasets: [
        { label: 'Protein (g)', data: avgMacros.map(d => d['Protein(g)']), backgroundColor: 'rgba(255, 99, 132, 0.7)' },
        { label: 'Carbs (g)', data: avgMacros.map(d => d['Carbs(g)']), backgroundColor: 'rgba(54, 162, 235, 0.7)' },
        { label: 'Fat (g)', data: avgMacros.map(d => d['Fat(g)']), backgroundColor: 'rgba(255, 206, 86, 0.7)' },
      ],
    };
  };

  const getDistributionChartData = () => {
    if (!data?.dataVisualizations?.dietDistribution) return null;
    return {
      labels: data.dataVisualizations.dietDistribution.map(d => d.diet_type),
      datasets: [{
        data: data.dataVisualizations.dietDistribution.map(d => d.count),
        backgroundColor: ['rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)'],
        borderColor: '#fff',
      }]
    };
  };

  const getProteinChartData = () => {
    if (!data?.dataVisualizations?.topProteinRecipes) return null;
    const top15 = data.dataVisualizations.topProteinRecipes.slice(0, 15);
    return {
      labels: top15.map(r => r.Recipe_name.substring(0, 25) + '...'),
      datasets: [{
        label: 'Protein (g)',
        data: top15.map(r => r['Protein(g)']),
        backgroundColor: 'rgba(102, 126, 234, 0.7)',
        borderColor: 'rgba(102, 126, 234, 1)',
        borderWidth: 1,
      }],
    };
  };

  // ================= RENDER =================

  // Wrap the entire Login View in GoogleOAuthProvider
  if (!user) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 p-8 rounded-xl shadow-2xl w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Diet Analytics
              </h1>
              <p className="text-gray-400 mt-2">Sign in to access the dashboard</p>
            </div>

            {authError && (
              <div className="bg-red-900/50 border border-red-700 text-red-200 p-3 rounded mb-4 text-sm text-center">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'register' && (
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Full Name</label>
                  <input required type="text" className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={name} onChange={e => setName(e.target.value)} />
                </div>
              )}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Email Address</label>
                <input required type="email" className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Password</label>
                <input required type="password" className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={password} onChange={e => setPassword(e.target.value)} />
              </div>

              <button disabled={authLoading} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded transition-all disabled:opacity-50">
                {authLoading ? 'Processing...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-600"></div></div>
                <div className="relative flex justify-center text-sm"><span className="px-2 bg-gray-800 text-gray-400">Or continue with</span></div>
              </div>
              
              <div className="flex flex-col gap-3 mt-4">
                {/* REAL Google Login Button */}
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setAuthError("Google Login Failed")}
                    theme="filled_black"
                    shape="pill"
                    width="100%"
                  />
                </div>

                {/* Fake GitHub Demo Button */}
                <button onClick={handleGitHubDemo} className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-medium text-sm transition-all flex items-center justify-center gap-2">
                  <span>GitHub (Demo)</span>
                </button>
              </div>
            </div>

            <p className="mt-6 text-center text-gray-400 text-sm">
              {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-blue-400 hover:text-blue-300 font-bold">
                {authMode === 'login' ? 'Register' : 'Login'}
              </button>
            </p>
          </div>
        </div>
      </GoogleOAuthProvider>
    );
  }

  // 2. Render Dashboard if Logged In
  return (
    <div className="min-h-screen bg-gray-900 p-6 font-sans text-gray-100">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Diet & Macro Analytics
            </h1>
            <div className="flex flex-col sm:flex-row gap-3 text-gray-400 text-sm mt-1">
              <p>Powered by Azure Functions</p>
              {data && (
                <span className={`px-2 py-0.5 rounded-full font-bold border ${data.executionTimeMs < 100 ? 'bg-green-900/30 text-green-400 border-green-700' : 'bg-yellow-900/30 text-yellow-400 border-yellow-700'}`}>
                  ⚡ Speed: {data.executionTimeMs} ms
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-400">Logged in as</p>
              <div className="flex items-center gap-2 justify-end">
                {user.picture && <img src={user.picture} alt="Profile" className="w-6 h-6 rounded-full" />}
                <p className="font-bold text-white">{user.name}</p>
              </div>
            </div>
             <button onClick={fetchDashboardData} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-sm transition-all text-white">
              {loading ? "..." : "Refresh"}
            </button>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-600 text-red-400 rounded-lg font-semibold text-sm transition-all">
              Logout
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg text-center">{error}</div>}

        {/* --- VISUALIZATIONS --- */}
        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {data.summary.map((item, index) => (
                <div key={index} className="bg-gray-800 border border-gray-700 p-4 rounded-xl shadow-md">
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">{item.label}</p>
                  <p className="text-2xl font-bold text-blue-400 mt-2">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-lg h-80">
                <h3 className="text-lg font-bold mb-4 text-gray-200">Average Macros</h3>
                <div className="h-full pb-6"><Bar data={getMacrosChartData()!} options={{ maintainAspectRatio: false, responsive: true }} /></div>
              </div>
              <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-lg h-80">
                <h3 className="text-lg font-bold mb-4 text-gray-200">Diet Distribution</h3>
                <div className="h-full pb-6"><Doughnut data={getDistributionChartData()!} options={{ maintainAspectRatio: false, responsive: true }} /></div>
              </div>
              <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-lg lg:col-span-2 h-96">
                <h3 className="text-lg font-bold mb-4 text-gray-200">Top High-Protein Recipes</h3>
                <div className="h-full pb-6"><Bar data={getProteinChartData()!} options={{ indexAxis: 'y', maintainAspectRatio: false, responsive: true }} /></div>
              </div>
            </div>
          </>
        )}

        <hr className="border-gray-700 my-12" />

        {/* --- SEARCH & PAGINATION --- */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 shadow-xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">Recipe Explorer</h2>
            <p className="text-gray-400 text-sm">Search database with caching.</p>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 mb-8">
            <input type="text" placeholder="Search recipes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-gray-900 border border-gray-600 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            <select value={dietFilter} onChange={(e) => { setDietFilter(e.target.value); setCurrentPage(1); }}
              className="bg-gray-900 border border-gray-600 text-white px-4 py-2 rounded-lg outline-none">
              <option value="">All Diets</option>
              <option value="dash">Dash</option>
              <option value="keto">Keto</option>
              <option value="mediterranean">Mediterranean</option>
              <option value="paleo">Paleo</option>
              <option value="vegan">Vegan</option>
            </select>
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold">Search</button>
          </form>

          {searchLoading ? <div className="text-center py-20 text-gray-400">Loading...</div> : (
            <>
              {recipesData?.recipes.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {recipesData.recipes.map((recipe, idx) => (
                    <div key={idx} className="bg-gray-700/50 border border-gray-600 p-4 rounded-lg hover:bg-gray-700 transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <span className="bg-blue-900 text-blue-200 text-xs font-bold px-2 py-1 rounded uppercase">{recipe.Diet_type}</span>
                        <span className="text-xs text-gray-400 truncate ml-2">{recipe.Cuisine_type}</span>
                      </div>
                      <h3 className="text-md font-bold text-white mb-2 line-clamp-2 h-12">{recipe.Recipe_name}</h3>
                      <div className="grid grid-cols-3 gap-1 mt-2 text-center text-xs">
                        <div className="bg-gray-800 rounded p-1"><p className="text-gray-400">P</p><p className="text-blue-400">{Math.round(recipe['Protein(g)'])}</p></div>
                        <div className="bg-gray-800 rounded p-1"><p className="text-gray-400">C</p><p className="text-green-400">{Math.round(recipe['Carbs(g)'])}</p></div>
                        <div className="bg-gray-800 rounded p-1"><p className="text-gray-400">F</p><p className="text-yellow-400">{Math.round(recipe['Fat(g)'])}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-10 text-gray-400">No recipes found.</div>}

              {recipesData && recipesData.total_pages > 1 && (
                <div className="flex justify-center items-center gap-4">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30">Prev</button>
                  <span className="text-gray-300 text-sm">Page {currentPage} of {recipesData.total_pages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(recipesData.total_pages, p + 1))} disabled={currentPage === recipesData.total_pages} className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
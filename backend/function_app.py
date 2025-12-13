import azure.functions as func
import pandas as pd
import json
import time
import logging
from azure.storage.blob import BlobServiceClient
from azure.data.tables import TableServiceClient
from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError
import io
import os
import math
import bcrypt

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# --- Helper Functions ---

def get_blob_client(blob_name):
    connection_string = os.environ["AzureWebJobsStorage"]
    blob_service_client = BlobServiceClient.from_connection_string(connection_string)
    return blob_service_client.get_blob_client(container="diet-data", blob=blob_name)

def get_table_client():
    connection_string = os.environ["AzureWebJobsStorage"]
    table_service_client = TableServiceClient.from_connection_string(connection_string)
    return table_service_client.create_table_if_not_exists(table_name="Users")

def perform_data_analysis(df):
    # (Data Cleaning Logic)
    for col in ['Protein(g)', 'Carbs(g)', 'Fat(g)']:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df.fillna(df.mean(numeric_only=True), inplace=True)
    
    avg_macros = df.groupby('Diet_type')[['Protein(g)', 'Carbs(g)', 'Fat(g)']].mean().reset_index()
    top_protein = df.sort_values('Protein(g)', ascending=False).groupby('Diet_type').head(5)
    highest_protein_diet = avg_macros.loc[avg_macros['Protein(g)'].idxmax()]
    highest_protein_str = f"{highest_protein_diet['Diet_type']} ({highest_protein_diet['Protein(g)']:2f}g)"
    common_cuisines_df = df.groupby('Diet_type')['Cuisine_type'].apply(lambda x: x.mode()[0] if len(x.mode()) > 0 else 'Unknown').reset_index()
    common_cuisines_map = common_cuisines_df.set_index('Diet_type')['Cuisine_type'].to_dict()
    df['Protein_to_Carbs_ratio'] = df['Protein(g)'] / df['Carbs(g)']
    diet_distribution = df['Diet_type'].value_counts().reset_index()
    diet_distribution.columns = ['diet_type', 'count']

    diet_distribution_list = diet_distribution.to_dict(orient='records')
    avg_macros_list = avg_macros.to_dict(orient='records')
    top_protein_list = top_protein[['Recipe_name', 'Protein(g)', 'Cuisine_type', 'Diet_type']].to_dict(orient='records')
    total_recipes = len(df)
    total_unique_diets = df['Diet_type'].nunique()
    
    dashboard_payload = {
        "title": "Diet and Macro-Nutrient Analysis Results",
        "lastUpdated": time.ctime(),
        "summary": [
            {"label": "Total Recipes analyzed", "value": f"{total_recipes}"},
            {"label": "Unique Diet Types", "value": f"{total_unique_diets}"},
            {"label": "Overall Avg. Protein (g)", "value":f"{df['Protein(g)'].mean():.2f}"},
            {"label": "Overall Avg. Carbs (g)", "value":f"{df['Carbs(g)'].mean():.2f}"},
            {"label": "Overall Avg. Fat (g)", "value":f"{df['Fat(g)'].mean():.2f}"}
        ],
        "dataVisualizations": {
            "avgMacros": avg_macros_list,
            "topProteinRecipes": top_protein_list,
            "dietDistribution": diet_distribution_list
        },
        "metadata": {
            "highestProteinDiet": highest_protein_str,
            "commonCuisines": common_cuisines_map
        }
    }
    df_clean = df.fillna("")
    full_recipes_list = df_clean.to_dict(orient='records')
    return dashboard_payload, full_recipes_list

# --- Feature 1: Blob Trigger ---
@app.blob_trigger(arg_name="myblob", path="diet-data/All_diets.csv", connection="AzureWebJobsStorage")
def process_diet_csv(myblob: func.InputStream):
    # 使用 print 取代 logging
    logging.warning(f">>> [TRIGGER] Blob Detected: {myblob.name}")
    try:
        print(">>> [TRIGGER] CSV updated. Starting HEAVY calculation (Simulating Data Cleaning)...")
        
        df = pd.read_csv(io.BytesIO(myblob.read()))
        dashboard_result, full_recipes = perform_data_analysis(df)
        
        blob_client_stats = get_blob_client("cached_results.json")
        blob_client_stats.upload_blob(json.dumps(dashboard_result), overwrite=True)
        
        blob_client_recipes = get_blob_client("cleaned_recipes.json")
        blob_client_recipes.upload_blob(json.dumps(full_recipes), overwrite=True)
        
        logging.warning(">>> [TRIGGER] Calculation DONE...")
    except Exception as e:
        logging.error(f"[ERROR] Blob Trigger Failed: {str(e)}")

# --- Feature 2: Dashboard API ---
@app.route(route="analyze", methods=["GET", "OPTIONS"])
def analyze_data(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers={"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type"})
    
    start_time = time.time()
    try:
        print("\n>>> [HTTP] Dashboard Request Received.")
        print(">>> [HTTP] Attempting to fetch from CACHE (cached_results.json)...")
        
        blob_client = get_blob_client("cached_results.json")
        cached_data = blob_client.download_blob().readall()
        result = json.loads(cached_data)
        
        end_time = time.time()
        exec_time = round((end_time - start_time) * 1000, 2)
        result['executionTimeMs'] = exec_time
        
        logging.warning(f">>> [HTTP] Cache HIT! Served in {exec_time} ms.")
        
        return func.HttpResponse(json.dumps(result), status_code=200, mimetype="application/json", headers={"Access-Control-Allow-Origin": "*"})
    except Exception as e:
        print(f">>> [HTTP] Cache MISS or Error: {str(e)}")
        return func.HttpResponse(json.dumps({"error": "Cache missing"}), status_code=500, headers={"Access-Control-Allow-Origin": "*"})

# --- Feature 3: Recipes Search API ---
@app.route(route="recipes", methods=["GET", "OPTIONS"])
def get_recipes(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers={"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type"})

    search_term = req.params.get('search', '').lower()
    diet_filter = req.params.get('diet', '')
    page = int(req.params.get('page', 1))
    limit = int(req.params.get('limit', 10))
    
    try:
        blob_client = get_blob_client("cleaned_recipes.json")
        cached_data = blob_client.download_blob().readall()
        recipes = json.loads(cached_data)
        
        filtered_recipes = recipes
        if diet_filter:
            filtered_recipes = [r for r in filtered_recipes if str(r.get('Diet_type', '')).lower() == diet_filter.lower()]
        if search_term:
            filtered_recipes = [r for r in filtered_recipes if search_term in str(r.get('Recipe_name', '')).lower() or search_term in str(r.get('Cuisine_type', '')).lower()]
            
        total_items = len(filtered_recipes)
        total_pages = math.ceil(total_items / limit)
        start = (page - 1) * limit
        end = start + limit
        
        return func.HttpResponse(json.dumps({
            "page": page, "total_pages": total_pages, "recipes": filtered_recipes[start:end]
        }), status_code=200, mimetype="application/json", headers={"Access-Control-Allow-Origin": "*"})
    except Exception as e:
        return func.HttpResponse(json.dumps({"error": str(e)}), status_code=500, headers={"Access-Control-Allow-Origin": "*"})

# --- Feature 4: User Authentication API ---
@app.route(route="register", methods=["POST", "OPTIONS"])
def register_user(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers={"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type"})
    try:
        req_body = req.get_json()
        email = req_body.get('email')
        password = req_body.get('password')
        name = req_body.get('name')
        if not email or not password:
            return func.HttpResponse(json.dumps({"error": "Email and password required"}), status_code=400, headers={"Access-Control-Allow-Origin": "*"})
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        user_entity = {"PartitionKey": "Users", "RowKey": email, "Name": name if name else email.split('@')[0], "PasswordHash": hashed.decode('utf-8')}
        table_client = get_table_client()
        table_client.create_entity(entity=user_entity)
        return func.HttpResponse(json.dumps({"message": "User registered successfully"}), status_code=201, headers={"Access-Control-Allow-Origin": "*"})
    except ResourceExistsError:
        return func.HttpResponse(json.dumps({"error": "User already exists"}), status_code=409, headers={"Access-Control-Allow-Origin": "*"})
    except Exception as e:
        return func.HttpResponse(json.dumps({"error": str(e)}), status_code=500, headers={"Access-Control-Allow-Origin": "*"})

@app.route(route="login", methods=["POST", "OPTIONS"])
def login_user(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers={"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type"})
    try:
        req_body = req.get_json()
        email = req_body.get('email')
        password = req_body.get('password')
        table_client = get_table_client()
        try:
            user = table_client.get_entity(partition_key="Users", row_key=email)
        except ResourceNotFoundError:
            return func.HttpResponse(json.dumps({"error": "Invalid email or password"}), status_code=401, headers={"Access-Control-Allow-Origin": "*"})
        stored_hash = user['PasswordHash'].encode('utf-8')
        if bcrypt.checkpw(password.encode('utf-8'), stored_hash):
            return func.HttpResponse(json.dumps({"message": "Login successful", "user": {"email": user['RowKey'], "name": user['Name']}}), status_code=200, mimetype="application/json", headers={"Access-Control-Allow-Origin": "*"})
        else:
            return func.HttpResponse(json.dumps({"error": "Invalid email or password"}), status_code=401, headers={"Access-Control-Allow-Origin": "*"})
    except Exception as e:
        return func.HttpResponse(json.dumps({"error": str(e)}), status_code=500, headers={"Access-Control-Allow-Origin": "*"})
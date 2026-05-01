from models.model_registry import model_registry
import sys

def run_download():
    print("=" * 60)
    print("m'AI Touch - 50+ Models Priority Strengthening Job")
    print("=" * 60)
    
    models = model_registry.list_models()
    # Target first 65 models to ensure we hit 50+ successfully
    priority_models = models[:65]
    
    print(f"Targeting {len(priority_models)} models for priority download.")
    
    success_count = 0
    for i, model in enumerate(priority_models, 1):
        print(f"\n[{i}/{len(priority_models)}] Processing: {model.name}")
        if model.downloaded:
            print("  - Already downloaded.")
            success_count += 1
            continue
            
        try:
            if model_registry.download_model(model.name):
                print(f"  - SUCCESS")
                success_count += 1
            else:
                print(f"  - FAILED")
        except Exception as e:
            print(f"  - ERROR: {e}")
            
    print("\n" + "=" * 60)
    print(f"Job Finished. Successfully downloaded models: {success_count}")
    print("=" * 60)

if __name__ == "__main__":
    run_download()

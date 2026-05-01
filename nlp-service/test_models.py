"""
Model Testing Script
測試模型下載和推理功能
"""

import asyncio
import time
from models.model_registry import model_registry
from models.model_loader import model_loader


def test_model_registry():
    """測試模型註冊表"""
    print("\n" + "="*60)
    print("測試模型註冊表")
    print("="*60)
    
    # 獲取統計
    stats = model_registry.get_statistics()
    
    print(f"\n總模型數: {stats['total_models']}")
    print(f"已下載: {stats['downloaded_models']}")
    
    print("\n按任務分類:")
    for task, count in sorted(stats['by_task'].items()):
        print(f"  {task}: {count}")
    
    print("\n按語言分類:")
    for lang, count in sorted(stats['by_language'].items()):
        print(f"  {lang}: {count}")
    
    print("\n" + "="*60)


def test_model_download(model_name: str = "intent-bert-tiny"):
    """測試模型下載"""
    print("\n" + "="*60)
    print(f"測試模型下載: {model_name}")
    print("="*60)
    
    model = model_registry.get_model(model_name)
    
    if not model:
        print(f"❌ 模型 {model_name} 不存在")
        return False
    
    print(f"\n模型信息:")
    print(f"  名稱: {model.name}")
    print(f"  版本: {model.version}")
    print(f"  任務: {model.task}")
    print(f"  語言: {model.language}")
    print(f"  大小: {model.size}")
    print(f"  已下載: {model.downloaded}")
    
    if not model.downloaded:
        print(f"\n開始下載...")
        start_time = time.time()
        
        success = model_registry.download_model(model_name)
        
        elapsed = time.time() - start_time
        
        if success:
            print(f"✅ 下載成功 ({elapsed:.1f}秒)")
            return True
        else:
            print(f"❌ 下載失敗")
            return False
    else:
        print(f"\n✅ 模型已下載")
        return True


def test_model_loading(model_name: str = "intent-bert-tiny", task: str = "classification"):
    """測試模型加載"""
    print("\n" + "="*60)
    print(f"測試模型加載: {model_name}")
    print("="*60)
    
    print(f"\n開始加載模型...")
    start_time = time.time()
    
    try:
        model_obj = model_loader.load_model(model_name, task)
        
        elapsed = time.time() - start_time
        
        if model_obj:
            print(f"✅ 加載成功 ({elapsed:.1f}秒)")
            print(f"\n模型信息:")
            print(f"  名稱: {model_obj['name']}")
            print(f"  任務: {model_obj['task']}")
            print(f"  類型: {model_obj['type']}")
            print(f"  設備: {model_obj['device']}")
            print(f"  有 Pipeline: {'pipeline' in model_obj}")
            return True
        else:
            print(f"❌ 加載失敗")
            return False
    
    except Exception as e:
        print(f"❌ 錯誤: {e}")
        return False


def test_model_inference(
    model_name: str = "intent-bert-tiny",
    task: str = "classification",
    text: str = "I need to fix my air conditioner"
):
    """測試模型推理"""
    print("\n" + "="*60)
    print(f"測試模型推理: {model_name}")
    print("="*60)
    
    print(f"\n輸入文本: {text}")
    
    # 確保模型已加載
    if model_name not in model_loader.get_loaded_models():
        print(f"\n模型未加載，正在加載...")
        model_obj = model_loader.load_model(model_name, task)
        if not model_obj:
            print(f"❌ 無法加載模型")
            return False
    
    print(f"\n開始推理...")
    start_time = time.time()
    
    try:
        result = model_loader.inference(model_name, text, task)
        
        elapsed = time.time() - start_time
        
        if result.get("success"):
            print(f"✅ 推理成功 ({elapsed*1000:.1f}ms)")
            print(f"\n結果:")
            
            inference_result = result.get("result")
            if isinstance(inference_result, list) and len(inference_result) > 0:
                for item in inference_result[:3]:  # 只顯示前3個
                    if isinstance(item, dict):
                        label = item.get("label", "N/A")
                        score = item.get("score", 0)
                        print(f"  {label}: {score:.4f}")
            else:
                print(f"  {inference_result}")
            
            return True
        else:
            print(f"❌ 推理失敗: {result.get('error')}")
            return False
    
    except Exception as e:
        print(f"❌ 錯誤: {e}")
        return False


def test_full_pipeline():
    """測試完整流程"""
    print("\n" + "="*80)
    print("完整流程測試")
    print("="*80)
    
    test_cases = [
        {
            "model": "intent-bert-tiny",
            "task": "classification",
            "text": "I need to fix my air conditioner"
        },
        {
            "model": "sentiment-bert",
            "task": "sentiment",
            "text": "The neighbor is too noisy"
        },
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{'='*80}")
        print(f"測試案例 {i}/{len(test_cases)}")
        print(f"{'='*80}")
        
        model_name = test_case["model"]
        task = test_case["task"]
        text = test_case["text"]
        
        # 1. 下載模型
        download_success = test_model_download(model_name)
        
        if not download_success:
            print(f"⚠️  跳過此測試（下載失敗）")
            results.append(False)
            continue
        
        # 2. 加載模型
        load_success = test_model_loading(model_name, task)
        
        if not load_success:
            print(f"⚠️  跳過推理測試（加載失敗）")
            results.append(False)
            continue
        
        # 3. 執行推理
        inference_success = test_model_inference(model_name, task, text)
        
        results.append(inference_success)
    
    # 總結
    print("\n" + "="*80)
    print("測試總結")
    print("="*80)
    
    total = len(results)
    passed = sum(results)
    failed = total - passed
    
    print(f"\n總測試數: {total}")
    print(f"通過: {passed}")
    print(f"失敗: {failed}")
    print(f"成功率: {passed/total*100:.1f}%")
    
    print("\n" + "="*80)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="測試 NLP 模型")
    
    parser.add_argument(
        "action",
        choices=["registry", "download", "load", "inference", "full"],
        help="測試類型"
    )
    
    parser.add_argument(
        "--model",
        default="intent-bert-tiny",
        help="模型名稱"
    )
    
    parser.add_argument(
        "--task",
        default="classification",
        help="任務類型"
    )
    
    parser.add_argument(
        "--text",
        default="I need to fix my air conditioner",
        help="測試文本"
    )
    
    args = parser.parse_args()
    
    if args.action == "registry":
        test_model_registry()
    
    elif args.action == "download":
        test_model_download(args.model)
    
    elif args.action == "load":
        test_model_loading(args.model, args.task)
    
    elif args.action == "inference":
        test_model_inference(args.model, args.task, args.text)
    
    elif args.action == "full":
        test_full_pipeline()


if __name__ == "__main__":
    main()

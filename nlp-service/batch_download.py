"""
Batch Download Script
批量下載常用的 NLP 模型
"""

import sys
import time
from models.model_registry import model_registry

# 推薦下載的模型列表（按優先級）
RECOMMENDED_MODELS = {
    "essential": [
        # 最基礎的模型（必須）
        "intent-bert-tiny",
        "sentiment-bert",
        "ner-bert-base",
    ],
    
    "chinese": [
        # 中文支持
        "intent-chinese-bert",
        "sentiment-chinese",
        "ner-chinese",
        "text-class-chinese",
        "qa-chinese",
        "embed-chinese",
    ],
    
    "multilingual": [
        # 多語言支持
        "intent-multilingual",
        "sentiment-multilingual",
        "ner-multilingual",
        "text-class-multilingual",
        "qa-multilingual",
        "embed-multilingual",
    ],
    
    "advanced": [
        # 高級功能
        "zero-shot-bart",
        "toxicity-detection",
        "emotion-detection",
        "embed-sentence-bert",
    ]
}


def download_category(category: str, force: bool = False):
    """下載特定類別的模型"""
    if category not in RECOMMENDED_MODELS:
        print(f"❌ 未知類別: {category}")
        print(f"可用類別: {', '.join(RECOMMENDED_MODELS.keys())}")
        return
    
    models = RECOMMENDED_MODELS[category]
    total = len(models)
    success = 0
    failed = 0
    
    print(f"\n{'='*60}")
    print(f"下載類別: {category.upper()}")
    print(f"模型數量: {total}")
    print(f"{'='*60}\n")
    
    for i, model_name in enumerate(models, 1):
        print(f"[{i}/{total}] 下載: {model_name}")
        
        model = model_registry.get_model(model_name)
        if not model:
            print(f"  ❌ 模型不存在")
            failed += 1
            continue
        
        if model.downloaded and not force:
            print(f"  ✅ 已下載（跳過）")
            success += 1
            continue
        
        try:
            start_time = time.time()
            result = model_registry.download_model(model_name, force=force)
            elapsed = time.time() - start_time
            
            if result:
                print(f"  ✅ 成功 ({elapsed:.1f}秒)")
                success += 1
            else:
                print(f"  ❌ 失敗")
                failed += 1
        
        except Exception as e:
            print(f"  ❌ 錯誤: {e}")
            failed += 1
        
        print()
    
    print(f"{'='*60}")
    print(f"完成!")
    print(f"成功: {success}/{total}")
    print(f"失敗: {failed}/{total}")
    print(f"{'='*60}\n")


def download_all_recommended(force: bool = False):
    """下載所有推薦的模型"""
    print("\n" + "="*60)
    print("批量下載推薦模型")
    print("="*60)
    
    for category in ["essential", "chinese", "multilingual", "advanced"]:
        download_category(category, force)
        print("\n")


def show_recommendations():
    """顯示推薦的模型"""
    print("\n" + "="*60)
    print("推薦下載的模型")
    print("="*60)
    
    for category, models in RECOMMENDED_MODELS.items():
        print(f"\n{category.upper()} ({len(models)} 個模型):")
        for model_name in models:
            model = model_registry.get_model(model_name)
            if model:
                status = "✅" if model.downloaded else "⬜"
                print(f"  {status} {model_name}")
                print(f"     任務: {model.task}, 語言: {model.language}, 大小: {model.size}")
            else:
                print(f"  ❌ {model_name} (不存在)")
    
    print("\n" + "="*60)
    
    # 統計
    total_recommended = sum(len(models) for models in RECOMMENDED_MODELS.values())
    downloaded = sum(
        1 for models in RECOMMENDED_MODELS.values()
        for model_name in models
        for _m in [model_registry.get_model(model_name)]
        if _m is not None and _m.downloaded
    )
    
    print(f"\n總推薦模型: {total_recommended}")
    print(f"已下載: {downloaded}")
    print(f"未下載: {total_recommended - downloaded}")
    print(f"完成度: {downloaded/total_recommended*100:.1f}%")
    print("="*60 + "\n")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="批量下載 NLP 模型")
    
    parser.add_argument(
        "action",
        choices=["show", "download", "all"],
        help="操作: show (顯示推薦), download (下載類別), all (下載所有推薦)"
    )
    
    parser.add_argument(
        "--category",
        choices=list(RECOMMENDED_MODELS.keys()),
        help="模型類別"
    )
    
    parser.add_argument(
        "--force",
        action="store_true",
        help="強制重新下載"
    )
    
    args = parser.parse_args()
    
    if args.action == "show":
        show_recommendations()
    
    elif args.action == "download":
        if not args.category:
            print("❌ 請指定 --category")
            print(f"可用類別: {', '.join(RECOMMENDED_MODELS.keys())}")
            sys.exit(1)
        
        download_category(args.category, args.force)
    
    elif args.action == "all":
        download_all_recommended(args.force)


if __name__ == "__main__":
    main()

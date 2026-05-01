"""
Model Download Script
下載和初始化所有 NLP 模型
"""

import sys
import argparse
from models.model_registry import model_registry
from mlops.model_monitor import model_monitor

def download_all_models():
    """下載所有模型"""
    print("=" * 60)
    print("開始下載所有 NLP 模型...")
    print("=" * 60)
    
    models = model_registry.list_models()
    total = len(models)
    success = 0
    failed = 0
    
    for i, model in enumerate(models, 1):
        print(f"\n[{i}/{total}] 下載模型: {model.name}")
        print(f"  任務: {model.task}")
        print(f"  語言: {model.language}")
        print(f"  大小: {model.size}")
        
        try:
            if model_registry.download_model(model.name):
                success += 1
                print(f"  ✅ 成功")
            else:
                failed += 1
                print(f"  ❌ 失敗")
        except Exception as e:
            failed += 1
            print(f"  ❌ 錯誤: {e}")
    
    print("\n" + "=" * 60)
    print("下載完成!")
    print(f"總計: {total} 個模型")
    print(f"成功: {success} 個")
    print(f"失敗: {failed} 個")
    print("=" * 60)
    
    return success, failed

def download_by_task(task: str):
    """按任務下載模型"""
    print(f"下載任務類型為 '{task}' 的模型...")
    
    models = model_registry.list_models(task=task)
    if not models:
        print(f"未找到任務類型為 '{task}' 的模型")
        return
    
    print(f"找到 {len(models)} 個模型")
    
    for model in models:
        print(f"\n下載: {model.name}")
        model_registry.download_model(model.name)

def download_by_language(language: str):
    """按語言下載模型"""
    print(f"下載語言為 '{language}' 的模型...")
    
    models = model_registry.list_models(language=language)
    if not models:
        print(f"未找到語言為 '{language}' 的模型")
        return
    
    print(f"找到 {len(models)} 個模型")
    
    for model in models:
        print(f"\n下載: {model.name}")
        model_registry.download_model(model.name)

def list_models(task=None, language=None, size=None):
    """列出模型"""
    models = model_registry.list_models(
        task=task,
        language=language,
        size=size
    )
    
    print(f"\n找到 {len(models)} 個模型:\n")
    
    # 按任務分組
    by_task = {}
    for model in models:
        if model.task not in by_task:
            by_task[model.task] = []
        by_task[model.task].append(model)
    
    for task, task_models in sorted(by_task.items()):
        print(f"\n{task.upper()} ({len(task_models)} 個模型):")
        for model in task_models:
            status = "✅" if model.downloaded else "⬜"
            print(f"  {status} {model.name} ({model.language}, {model.size})")

def show_statistics():
    """顯示統計信息"""
    stats = model_registry.get_statistics()
    
    print("\n" + "=" * 60)
    print("模型統計信息")
    print("=" * 60)
    
    print(f"\n總模型數: {stats['total_models']}")
    print(f"已下載: {stats['downloaded_models']}")
    print(f"未下載: {stats['total_models'] - stats['downloaded_models']}")
    
    print("\n按任務分類:")
    for task, count in sorted(stats['by_task'].items()):
        print(f"  {task}: {count}")
    
    print("\n按語言分類:")
    for lang, count in sorted(stats['by_language'].items()):
        print(f"  {lang}: {count}")
    
    print("\n按大小分類:")
    for size, count in sorted(stats['by_size'].items()):
        print(f"  {size}: {count}")
    
    if stats['most_used']:
        print("\n最常使用的模型:")
        for model in stats['most_used'][:5]:
            print(f"  {model['name']}: {model['usage_count']} 次")
    
    print("=" * 60)

def main():
    parser = argparse.ArgumentParser(description="NLP 模型下載工具")
    
    parser.add_argument(
        "action",
        choices=["download", "list", "stats"],
        help="操作: download (下載), list (列表), stats (統計)"
    )
    
    parser.add_argument(
        "--task",
        help="任務類型 (classification, ner, sentiment, etc.)"
    )
    
    parser.add_argument(
        "--language",
        help="語言 (en, zh, multi)"
    )
    
    parser.add_argument(
        "--size",
        help="模型大小 (tiny, small, base, large)"
    )
    
    parser.add_argument(
        "--all",
        action="store_true",
        help="下載所有模型"
    )
    
    args = parser.parse_args()
    
    if args.action == "download":
        if args.all:
            download_all_models()
        elif args.task:
            download_by_task(args.task)
        elif args.language:
            download_by_language(args.language)
        else:
            print("請指定 --all, --task 或 --language")
            sys.exit(1)
    
    elif args.action == "list":
        list_models(
            task=args.task,
            language=args.language,
            size=args.size
        )
    
    elif args.action == "stats":
        show_statistics()

if __name__ == "__main__":
    main()

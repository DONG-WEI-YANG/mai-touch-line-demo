"""
Quick test script for NLP service
"""
import requests
import json
import time


def test_health():
    """Test health endpoint"""
    print("🔍 Testing health endpoint...")
    response = requests.get("http://localhost:8000/health")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    print()


def test_analyze():
    """Test analyze endpoint"""
    print("🔍 Testing analyze endpoint...")
    
    test_cases = [
        {
            "text": "空調壞了，需要緊急維修",
            "task": "intent",
            "language": "zh"
        },
        {
            "text": "I want to book the gym tomorrow",
            "task": "intent",
            "language": "en"
        },
        {
            "text": "鄰居太吵了，能幫我處理嗎？",
            "task": "sentiment",
            "language": "zh"
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\nTest {i}: {test_case['text']}")
        
        start = time.time()
        response = requests.post(
            "http://localhost:8000/analyze",
            json=test_case
        )
        elapsed = (time.time() - start) * 1000
        
        print(f"Status: {response.status_code}")
        print(f"Time: {elapsed:.2f}ms")
        
        if response.status_code == 200:
            result = response.json()
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(f"Error: {response.text}")
        
        print("-" * 50)


def test_batch():
    """Test batch analyze endpoint"""
    print("\n🔍 Testing batch analyze endpoint...")
    
    batch_requests = [
        {"text": "預約健身房", "task": "intent"},
        {"text": "空調壞了", "task": "intent"},
        {"text": "鄰居很吵", "task": "sentiment"}
    ]
    
    start = time.time()
    response = requests.post(
        "http://localhost:8000/batch-analyze",
        json=batch_requests
    )
    elapsed = (time.time() - start) * 1000
    
    print(f"Status: {response.status_code}")
    print(f"Time: {elapsed:.2f}ms")
    print(f"Avg per request: {elapsed/len(batch_requests):.2f}ms")
    
    if response.status_code == 200:
        result = response.json()
        print(json.dumps(result, indent=2, ensure_ascii=False))


def test_stats():
    """Test stats endpoint"""
    print("\n🔍 Testing stats endpoint...")
    response = requests.get("http://localhost:8000/stats")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))


def main():
    """Run all tests"""
    print("=" * 60)
    print("m'AI Touch NLP Service - Test Suite")
    print("=" * 60)
    
    try:
        test_health()
        test_analyze()
        test_batch()
        test_stats()
        
        print("\n✅ All tests completed!")
        
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Cannot connect to NLP service")
        print("Please make sure the service is running:")
        print("  Windows: start.bat")
        print("  Linux/Mac: bash start.sh")
    
    except Exception as e:
        print(f"\n❌ Error: {e}")


if __name__ == "__main__":
    main()

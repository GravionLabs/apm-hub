# AAA Test Example

```csharp
[Test]
[Category("UnitTest")]
public async Task Should_return_user_when_valid_id()
{
    var repo = Substitute.For<IUserRepository>();
    repo.GetByIdAsync("123", Arg.Any<CancellationToken>()).Returns(new User { Id = "123" });
    var sut = new UserService(repo);

    var result = await sut.GetUserAsync("123");

    result.ShouldNotBeNull();
    result.Id.ShouldBe("123");
}
```
